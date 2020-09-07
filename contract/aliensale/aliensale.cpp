#include "aliensale.hpp"

using namespace alienworlds;

aliensale::aliensale(name s, name code, datastream<const char *> ds) : contract(s, code, ds),
                                                                       _addresses(get_self(), get_self().value),
                                                                       _invoices(get_self(), get_self().value),
                                                                       _auctions(get_self(), get_self().value),
                                                                       _packs(get_self(), get_self().value),
                                                                       _deposits(get_self(), get_self().value),
                                                                       _swaps(get_self(), get_self().value) {}


void aliensale::addpack(uint64_t pack_id, extended_asset pack_asset, string metadata, uint8_t number_cards) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack == _packs.end(), "Pack already exists with this ID");

    // check pack exists with same symbol
    uint128_t id = pack_item::extended_asset_id(pack_asset);
    auto asset_ind = _packs.get_index<"bypack"_n>();
    auto pack2 = asset_ind.find(id);
    check(pack2 == asset_ind.end(), "Pack already exists with this symbol");

    _packs.emplace(get_self(), [&](auto &p){
        p.pack_id      = pack_id;
        p.pack_asset   = pack_asset;
        p.number_cards = number_cards;
        p.metadata     = metadata;
    });
}

void aliensale::editpack(uint64_t pack_id, string metadata, uint8_t number_cards) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack with this ID not found");

    _packs.modify(pack, get_self(), [&](auto &p){
        p.number_cards = number_cards;
        p.metadata     = metadata;
    });
}

void aliensale::delpack(uint64_t pack_id) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack not found");

    _packs.erase(pack);
}

void aliensale::addaddress(uint64_t address_id, name foreign_chain, string address) {
    require_auth(get_self());

    _addresses.emplace(get_self(), [&](auto &a){
        a.address_id      = address_id;  // normally the hd derivation path
        a.foreign_chain   = foreign_chain;
        a.foreign_address = address;
    });
}

void aliensale::newinvoice(name native_address, uint64_t auction_id, uint8_t qty) {
    require_auth(native_address);
    check(qty > 0, "Quantity cannot be negative");

    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    name foreign_chain = auction->price_symbol.chain;
    extended_symbol settlement_currency{auction->price_symbol.symbol, auction->price_symbol.contract};

    // get the next available foreign address
    // create the sale record so that we can give the payment address and price to the user
    auto chain_idx = _addresses.get_index<"bychain"_n>();
    auto addr = chain_idx.begin();
    while (addr != chain_idx.end() && addr->foreign_chain != foreign_chain){
        addr++;
    }
    check(addr != chain_idx.end(), "Could not find payment address");

    string foreign_address = addr->foreign_address;


    uint64_t invoice_id = _invoices.available_primary_key();
    uint64_t foreign_price = auction_price(auction_id, qty);

    _invoices.emplace(native_address, [&](auto &s){
        s.invoice_id       = invoice_id;
        s.auction_id       = auction_id;
        s.address_id       = addr->address_id;
        s.native_address   = native_address;
        s.foreign_address  = foreign_address;

        foreign_symbol    fs{foreign_chain, settlement_currency.get_contract(), settlement_currency.get_symbol()};

        s.invoice_currency = fs;
        s.price            = foreign_price;
        s.invoice_time     = time_point(current_time_point().time_since_epoch());
        s.completed        = false;
    });

    // remove the address
    chain_idx.erase(addr);

    // log sale
    action(
        permission_level{get_self(), "log"_n},
        get_self(), "loginvoice"_n,
        make_tuple(native_address, invoice_id, foreign_price, foreign_address, settlement_currency)
    ).send();
}

void aliensale::loginvoice(name native_address, uint64_t invoice_id, uint64_t foreign_price, string foreign_address, extended_symbol settlement_currency) {}

void aliensale::delinvoice(uint64_t invoice_id) {
    require_auth(get_self());

    auto invoice = _invoices.find(invoice_id);
    check(invoice != _invoices.end(), "Invoice not found");

    _invoices.erase(invoice);
}

void aliensale::payment(uint64_t invoice_id, string tx_id) {
    require_auth(get_self());

    auto invoice = _invoices.find(invoice_id);
    check(invoice != _invoices.end(), "Invoice not found");

    if (!invoice->completed){
        for (auto item: invoice->items){
            // send each transfer
            action(
                    permission_level{get_self(), "xfer"_n},
                    item.contract, "transfer"_n,
                    make_tuple(get_self(), invoice->native_address, item.quantity, tx_id)
            ).send();
        }

        _invoices.modify(invoice, get_self(), [&](auto &i){
            i.completed       = true;
            i.completed_tx_id = tx_id;
        });
    }


}

void aliensale::transfer(name from, name to, asset quantity, string memo) {
    if (from == get_self() || to != get_self()){ // make sure transfer is to us
        return;
    }
    if (from == "eosio.stake"_n || from == "eosio.ram"_n){ // system contracts
        return;
    }

    auto deposit = _deposits.find(from.value);
    check(deposit == _deposits.end(), "You already have a deposit, please complete the previous sale");

    _deposits.emplace(get_self(), [&](auto &d){
        d.account  = from;
        d.quantity = quantity;
    });
}

void aliensale::buy(name buyer, uint64_t auction_id, uint8_t qty) {
    check(qty > 0, "Quantity cannot be negative");
    require_auth(buyer);
    // check they have correct deposit and send out packs
    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    auto deposit = _deposits.find(buyer.value);
    check(deposit != _deposits.end(), "Deposit not found");

    check(auction->price_symbol.symbol == symbol{symbol_code{"WAX"}, 8}, "Please use createsale for non-native sales");

    auto pack_price = auction_price(auction_id, qty);
    check(pack_price == deposit->quantity.amount, "Incorrect amount deposited");

    auto pack_asset = auction->pack.quantity * qty;
    string memo = "Buying in auction";

    action(
        permission_level{get_self(), "xfer"_n},
        auction->pack.contract, "transfer"_n,
        make_tuple(get_self(), buyer, pack_asset, memo)
    ).send();

    _deposits.erase(deposit);
}

/*
void aliensale::swap(name buyer, asset quantity, checksum256 tx_id) {
    // check that tx_id hasnt been used before
    auto swp_idx = _swaps.get_index<"bytxid"_n>();
    auto swap = swp_idx.find(tx_id);
    check(swap == swp_idx.end(), "Swap is already completed");

    // send the pack tokens out
    check(quantity.is_valid(), "Quantity not valid");
    auto pack_asset = extended_asset{quantity, SWAP_PACK_CONTRACT};
    uint128_t id = pack_item::extended_asset_id(pack_asset);
    auto asset_ind = _packs.get_index<"bypack"_n>();
    auto pack = asset_ind.find(id);
    check(pack != asset_ind.end(), "Pack not found with this symbol");

    auto pack_to_send = pack->pack_asset;
    pack_to_send.quantity.amount = quantity.amount;
    string memo = "Swap pack voucher";
    action(
        permission_level{get_self(), "xfer"_n},
        pack_to_send.contract, "transfer"_n,
        make_tuple(get_self(), buyer, pack_to_send.quantity, memo)
    ).send();

    // enter the swap
    _swaps.emplace(get_self(), [&](auto &s){
        s.swap_id = _swaps.available_primary_key();
        s.account = buyer;
        s.tx_id = tx_id;
        s.quantity = quantity;
    });
}

void aliensale::ethswap(std::vector<char> sig, string account_str) {
    sha3_ctx      shactx;
    unsigned char tmpmsghash[32];
    char          tmpmsg[12];

    using ecc_signature = std::array<char, 65>;
    using ecc_public_key = array<char, 33>;

//    print("\nsig 0", sig[10]);
//    check(false, "b");

    check(account_str.size() <= 12, "Account name is too long");

    //Add prefix and length of signed message
    char message[128];
    sprintf(message, "%s%s%d%s", "\x19", "Ethereum Signed Message:\n", strlen(account_str.c_str()), account_str.c_str());
    print("\nMessage ", message);

    rhash_keccak_256_init(&shactx);
    rhash_keccak_update(&shactx, (const unsigned char*)message, strlen(message)); // ignore the null terminator at the end of the string
    rhash_keccak_final(&shactx, &tmpmsghash[0]);
//    print("\nTemp Msg hash", string(tmpmsghash));

    // convert the result to checksum256
    array<uint8_t, 32> result_arr;
    copy(begin(tmpmsghash), end(tmpmsghash), result_arr.begin());
    auto msghash = eosio::fixed_bytes<32>(result_arr);

    // convert signature bytes to an eosio signature
    ecc_signature sig_arr;
    copy_n(sig.begin(), 65, sig_arr.begin());

    // Recover the compressed ETH public key from the message and signature
    signature sig_eosio{ std::in_place_index<0>, sig_arr };  // 0 = k1
    print("\nMsg hash", msghash);
    eosio::public_key eosio_pubkey = recover_key(msghash, sig_eosio);
    auto compressed_pubkey = std::get<0>(eosio_pubkey);

    // Decompress the ETH pubkey
    uint8_t pubkey[64];
    // uint8_t compressed_pubkey_int
    uECC_decompress((uint8_t *)compressed_pubkey.data() + 1, pubkey, uECC_secp256k1());

    // Calculate the hash of the pubkey
    unsigned char pubkeyhash[32];
    rhash_keccak_256_init(&shactx);
    rhash_keccak_update(&shactx, pubkey, 64);
    rhash_keccak_final(&shactx, &pubkeyhash[0]);

    // last 20 bytes of the hashed pubkey = ETH address
    uint8_t eth_address[20];
    memcpy(eth_address, pubkeyhash + 12, 20);

    // convert to human readable form
    std::string calculated_eth_address = bytetohex(eth_address, 20);

    print("calculated eth address", calculated_eth_address);

    check(false, "blah");
}
*/

void aliensale::clearinvs() {
    require_auth(get_self());

    auto invoice = _invoices.begin();
    while (invoice != _invoices.end()){
      invoice = _invoices.erase(invoice);
    }
}

void aliensale::clearpacks() {
    require_auth(get_self());

    auto pack = _packs.begin();
    while (pack != _packs.end()){
        pack = _packs.erase(pack);
    }
}

void aliensale::clearswaps() {
    require_auth(get_self());

    auto swap = _swaps.begin();
    while (swap != _swaps.end()){
        swap = _swaps.erase(swap);
    }
}

void aliensale::clearaddress() {
    require_auth(get_self());

    auto address = _addresses.begin();
    while (address != _addresses.end()){
        address = _addresses.erase(address);
    }
}


// Private
std::string aliensale::bytetohex(unsigned char *data, int len) {
    constexpr char hexmap[] = {'0', '1', '2', '3', '4', '5', '6', '7',
                               '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'};

    std::string s(len * 2, ' ');
    for (int i = 0; i < len; ++i) {
      s[2 * i]     = hexmap[(data[i] & 0xF0) >> 4];
      s[2 * i + 1] = hexmap[data[i] & 0x0F];
    }
    return s;
}

/*uint64_t aliensale::compute_price(vector<extended_asset> items, extended_symbol settlement_currency, name foreign_chain) {

    auto pack_ind = _packs.get_index<"bypack"_n>();

    uint64_t total = 0;
    for (auto item: items){
        // get price from sales packs table
        auto pack = pack_ind.find(pack_item::extended_asset_id(item));
        check(pack != pack_ind.end(), "Pack not found");
        check(pack->allow_sale, "Pack sale not allowed");

        bool needs_conversion = true;
        name quote_pair;
        if (settlement_currency.get_symbol().code() == symbol_code{"ETH"}){
            quote_pair = "waxpeth"_n;
        }
        else if (settlement_currency.get_symbol().code() == symbol_code{"EOS"}){
            quote_pair = "waxpeos"_n;
        }
        else if (pack->quote_price.quantity.symbol != settlement_currency.get_symbol()) {
            check(false, "Quote pair unknown");
        }
        else {
            needs_conversion = false;
        }

        // Check that this settlement currency is allowed for the pack
        bool symbol_allowed = false;
        for (auto sale_symbol: pack->sale_symbols){
            if (sale_symbol.chain == foreign_chain
                && sale_symbol.symbol == settlement_currency.get_symbol()
                && sale_symbol.contract == settlement_currency.get_contract()){

                symbol_allowed = true;
                break;
            }
        }
        check(symbol_allowed, "Sale currency is not allowed for this pack");

        auto _datapoints = datapointstable(DELPHI_CONTRACT, quote_pair.value);
        auto _pairs = pairstable(DELPHI_CONTRACT, DELPHI_CONTRACT.value);

        double pack_price = (double)pack->quote_price.quantity.amount / pow(10, (double)pack->quote_price.quantity.symbol.precision());

        if (pack->quote_price.quantity.symbol != settlement_currency.get_symbol() && needs_conversion){

            auto pair_itr = _pairs.find(quote_pair.value);
            check(pair_itr != _pairs.end(), "Pair not found");

            auto dpi = _datapoints.get_index<"timestamp"_n>();
            auto last_dp = dpi.rbegin();

            uint64_t precision = pair_itr->quoted_precision;
            uint64_t base_median = last_dp->median;

            double conversion_price = (double)base_median / pow(10.0, (double)precision);  // in full tokens

            total += (uint64_t)((double)item.quantity.amount * pack_price * conversion_price * pow(10, (double)pair_itr->quote_symbol.precision()));
        }
        else {
            // settlement is same as quote so price is the same
            total += (uint64_t)((double)item.quantity.amount * pack_price * pow(10, (double)settlement_currency.get_symbol().precision()));
        }
    }

    return total;
}*/

uint64_t aliensale::auction_price(uint64_t auction_id, uint8_t qty) {
    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    uint32_t time_now = current_time_point().sec_since_epoch();
    uint32_t time_into_sale = time_now - auction->start_time.sec_since_epoch();
    check(time_now >= auction->start_time.sec_since_epoch(), "Auction has not started yet");

    auto start_price = auction->start_price;
    uint32_t current_time = 0;
    uint32_t cycle_length = auction->period_length + auction->break_length;
    uint32_t remainder = time_into_sale % cycle_length;
    uint8_t period_number = (time_into_sale - remainder) / cycle_length;

    // we are in the break period
    check(remainder <= auction->period_length, "Auction is in a rest period");

    if (period_number > auction->period_count) {
        period_number = auction->period_count;
    }

    return start_price * (period_number * auction->price_step);
}
