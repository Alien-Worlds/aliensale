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

void aliensale::addauction(extended_asset pack, time_point start_time, foreign_symbol price_symbol, uint64_t start_price, uint32_t period_length, uint32_t break_length, uint64_t first_step, uint64_t price_step, uint8_t period_count) {
    require_auth(get_self());

    check((start_price - (first_step + (price_step * period_count - 1))) > 0, "Auction final price is not above 0");

    uint64_t auction_id = _auctions.available_primary_key();
    _auctions.emplace(get_self(), [&](auto &a){
        a.auction_id = auction_id;
        a.pack = pack;
        a.start_time = start_time;
        a.price_symbol = price_symbol;
        a.start_price = start_price;
        a.period_length = period_length;
        a.break_length = break_length;
        a.first_step = first_step;
        a.price_step = price_step;
        a.period_count = period_count;
    });
}

void aliensale::delauction(uint64_t auction_id) {
    require_auth(get_self());

    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    _auctions.erase(auction);
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

    _invoices.emplace(native_address, [&](auto &i){
        i.invoice_id       = invoice_id;
        i.auction_id       = auction_id;
        i.address_id       = addr->address_id;
        i.native_address   = native_address;
        i.foreign_address  = foreign_address;
        i.qty              = qty;

        foreign_symbol    fs{foreign_chain, settlement_currency.get_contract(), settlement_currency.get_symbol()};

        i.invoice_currency = fs;
        i.price            = foreign_price;
        i.invoice_time     = time_point(current_time_point().time_since_epoch());
        i.completed        = false;
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

    auto auction = _auctions.find(invoice->auction_id);
    check(auction != _auctions.end(), "Auction not found");

    if (!invoice->completed){
        auto pack_asset = auction->pack.quantity;
        pack_asset.amount = invoice->qty;

        action(
            permission_level{get_self(), "xfer"_n},
            auction->pack.contract, "transfer"_n,
            make_tuple(get_self(), invoice->native_address, pack_asset, tx_id)
        ).send();

        // deduct amount bought from auction
        _auctions.modify(auction, get_self(), [&](auto &a){
            a.pack.quantity.amount -= invoice->qty;
        });

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
    check(deposit->quantity.symbol == symbol{symbol_code{"WAX"}, 8}, "Incorrect deposit symbol");

    auto pack_price = auction_price(auction_id, qty);
    print("\npack price ", pack_price);
    check(pack_price == deposit->quantity.amount, "Incorrect amount deposited");

    auto pack_asset = auction->pack.quantity;
    pack_asset.amount = (uint64_t)qty;
    string memo = "Buying in auction";

    // deduct amount bought from auction
    _auctions.modify(auction, get_self(), [&](auto &a){
        a.pack.quantity.amount -= qty;
    });

    action(
        permission_level{get_self(), "xfer"_n},
        auction->pack.contract, "transfer"_n,
        make_tuple(get_self(), buyer, pack_asset, memo)
    ).send();

    _deposits.erase(deposit);
}


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

/*
 * {
  "address": "0x82828c12b86b0968f8ada61aca2fc4903b64deb9",
  "msg": "evilmikehere",
  "sig": "0xc9629f161f1a7614e884d0914771befcb591a3691cf49d4cefa5b70429add88156d042ac807c4f4e9d9059d5d118f6a83ebd9eb09947361f9dac3a9e4ebb61d91b",
  "version": "2"
}
 */
void aliensale::ethswap(std::vector<char> sig, string account_str) {
    /* sha3_ctx      shactx;
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
    rhash_keccak_update(&shactx, (const unsigned char*)message, strlen(message)-1); // ignore the null terminator at the end of the string
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
    uint8_t pubkey[65];
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
*/
    check(false, "blah");
}


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

void aliensale::clearauction() {
    require_auth(get_self());

    auto auction = _auctions.begin();
    while (auction != _auctions.end()){
      auction = _auctions.erase(auction);
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

uint64_t aliensale::auction_price(uint64_t auction_id, uint8_t qty) {
    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    uint32_t time_now = current_time_point().sec_since_epoch();
    check(time_now >= auction->start_time.sec_since_epoch(), "Auction has not started yet");
    uint32_t time_into_sale = time_now - auction->start_time.sec_since_epoch();

    auto start_price = auction->start_price;
    uint32_t cycle_length = auction->period_length + auction->break_length;
    uint32_t remainder = time_into_sale % cycle_length;
    uint32_t period_number = (time_into_sale - remainder) / cycle_length;

    // we are in the break period
    check(remainder <= auction->period_length, "Auction is in a rest period");

    if (period_number > auction->period_count) {
        period_number = auction->period_count;
    }

    uint64_t price = start_price;
    if (period_number >= 1){
        price -= auction->first_step;
    }
    price -= (period_number - 1) * auction->price_step;

    return price * qty;
}
