#include "aliensale.hpp"

using namespace alienworlds;

aliensale::aliensale(name s, name code, datastream<const char *> ds) : contract(s, code, ds),
                                                                       _addresses(get_self(), get_self().value),
                                                                       _invoices(get_self(), get_self().value),
                                                                       _sales(get_self(), get_self().value),
                                                                       _auctions(get_self(), get_self().value),
                                                                       _packs(get_self(), get_self().value),
                                                                       _deposits(get_self(), get_self().value),
                                                                       _swaps(get_self(), get_self().value),
                                                                       _preorders(get_self(), get_self().value),
                                                                       _ethswaps(get_self(), get_self().value) {}


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
        a.auction_id    = auction_id;
        a.pack          = pack;
        a.start_time    = start_time;
        a.price_symbol  = price_symbol;
        a.start_price   = start_price;
        a.period_length = period_length;
        a.break_length  = break_length;
        a.first_step    = first_step;
        a.price_step    = price_step;
        a.period_count  = period_count;
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

void aliensale::newinvoice(name native_address, uint64_t auction_id, uint8_t qty, string referrer) {
    require_auth(native_address);
    check(qty > 0, "Quantity cannot be negative");

    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    name foreign_chain = auction->price_symbol.chain;
    extended_symbol settlement_currency{auction->price_symbol.symbol, auction->price_symbol.contract};

    // get the next available foreign address
    // create the sale record so that we can give the payment address and price to the user
    auto chain_idx = _addresses.get_index<"bychain"_n>();
    auto addr = chain_idx.find(foreign_chain.value);
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
        make_tuple(native_address, invoice_id, foreign_price, foreign_address, settlement_currency, referrer)
    ).send();
}

void aliensale::loginvoice(name native_address, uint64_t invoice_id, uint64_t foreign_price, string foreign_address, extended_symbol settlement_currency, string referrer) {}

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

void aliensale::buy(name buyer, uint64_t auction_id, uint8_t qty, string referrer) {
    check(qty > 0, "Quantity cannot be negative");
    require_auth(buyer);
    // check they have correct deposit and send out packs
    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    auto deposit = _deposits.find(buyer.value);
    check(deposit != _deposits.end(), "Deposit not found");

    check(auction->price_symbol.symbol == symbol{symbol_code{"WAX"}, 8}, "Please use createsale for non-native sales");
    check(deposit->quantity.symbol == symbol{symbol_code{"WAX"}, 8}, "Incorrect deposit symbol");
    check(qty <= auction->pack.quantity.amount, "Attempt to buy more than is available");

    // check there are no outstanding reservations that have not been processed
    auto auction_period = current_period(auction_id);
    uint128_t start = 0;
    start |= (uint128_t)auction_id << 96;
//    start |= (uint128_t)auction_period << 64;

    auto index = _preorders.get_index<"byauction"_n>();
    auto reservation = index.lower_bound(start);

    if (reservation != index.end() && reservation->auction_id == auction_id && auction_period >= reservation->auction_period){
        check(false, "Please wait for reservations to be processed, try again soon");
    }

    auto pack_price = auction_price(auction_id, qty);
//    print("\npack price ", pack_price);
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

    // add sale record
    _sales.emplace(get_self(), [&](auto &s){
        s.sale_id    = _sales.available_primary_key();
        s.auction_id = auction_id;
        s.quantity   = deposit->quantity;
        s.referrer   = referrer;
    });

    _deposits.erase(deposit);
}

void aliensale::preorder(name buyer, uint64_t auction_id, uint16_t auction_period, uint8_t qty, string referrer) {
    check(qty > 0, "Quantity cannot be negative");
    require_auth(buyer);

    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    check(auction_period < auction->period_count, "Auction has less periods than this");

    name foreign_chain = auction->price_symbol.chain;
    extended_symbol settlement_currency{auction->price_symbol.symbol, auction->price_symbol.contract};

    uint64_t amount = auction_price_from_period(auction_id, auction_period, qty);
    asset quantity(amount, auction->price_symbol.symbol);

    bool paid = false;
    string foreign_address = "";

    if (foreign_chain == "wax"_n){
        auto deposit = _deposits.find(buyer.value);
        check(deposit != _deposits.end(), "Deposit not found");

        check(deposit->quantity.symbol == symbol{symbol_code{"WAX"}, 8}, "Incorrect deposit symbol");
        check(qty <= auction->pack.quantity.amount, "Attempt to reserve more than is available");
        check(amount == deposit->quantity.amount, "Incorrect amount deposited");

        paid = true;

        _deposits.erase(deposit);
    }
    else {
        auto chain_idx = _addresses.get_index<"bychain"_n>();
        auto addr = chain_idx.find(foreign_chain.value);
        check(addr != chain_idx.end(), "Could not find payment address");

        foreign_address = addr->foreign_address;

        chain_idx.erase(addr);
    }

    uint64_t preorder_id = _preorders.available_primary_key();

    _preorders.emplace(buyer, [&](auto &r){
        r.preorder_id      = preorder_id;
        r.auction_id       = auction_id;
        r.auction_period   = auction_period;
        r.preorder_time    = time_point(current_time_point().time_since_epoch());
        r.number_packs     = qty;
        r.quantity         = quantity;
        r.paid             = paid;
        r.foreign_address  = foreign_address;
        r.account          = buyer;
        r.referrer         = referrer;
    });

    action(
        permission_level{get_self(), "log"_n},
        get_self(), "logpreorder"_n,
        make_tuple(buyer, auction_id, auction_period, preorder_id, amount, foreign_address)
    ).send();
}

void aliensale::logpreorder(name native_address, uint64_t auction_id, uint16_t auction_period, uint64_t preorder_id, uint64_t foreign_price, string foreign_address) {}

void aliensale::processpre(uint64_t auction_id, uint16_t auction_period, uint8_t loop_count) {
    // process "loop_count" items from the reservations table, delete unpaid entries as we go
    uint128_t start = 0;
    start |= (uint128_t)auction_id << 96;
    start |= (uint128_t)auction_period << 64;
    bool is_overbuy = false;

    uint32_t current = current_period(auction_id);
    check(auction_period <= current, "Auction period hasnt started yet");

    auto index = _preorders.get_index<"byauction"_n>();
    auto preorder = index.lower_bound(start);
    while (loop_count >= 0) {
        if (preorder->auction_id != auction_id || preorder->auction_period != auction_period){
            break;
        }

        auto auction = _auctions.find(auction_id);
        uint64_t packs_reserved = 0;
        uint64_t new_price;

        if (preorder->paid && auction != _auctions.end()){
            // send tokens
          packs_reserved = (uint64_t)preorder->number_packs;
          if (auction->pack.quantity.amount < packs_reserved){
              packs_reserved = auction->pack.quantity.amount;
              is_overbuy = true;
              new_price = auction_price_from_period(auction_id, auction_period, preorder->number_packs - auction->pack.quantity.amount);
          }
          auto pack_asset = auction->pack.quantity;
          pack_asset.amount = packs_reserved;
          string memo = "Buying in auction (pre-order)";

          // deduct amount bought from auction
          _auctions.modify(auction, get_self(), [&](auto &a){
              a.pack.quantity.amount -= pack_asset.amount;
          });

          action(
              permission_level{get_self(), "xfer"_n},
              auction->pack.contract, "transfer"_n,
              make_tuple(get_self(), preorder->account, pack_asset, memo)
          ).send();

          // add sale record
          _sales.emplace(get_self(), [&](auto &s){
              s.sale_id    = _sales.available_primary_key();
              s.auction_id = auction_id;
              s.quantity   = preorder->quantity;
              s.referrer   = preorder->referrer;
          });
        }

        if (is_overbuy){
            // if reservation was overbought then the auction has ended and all packs sold
            _preorders.modify(*preorder, get_self(), [&](auto &r){
                r.number_packs = r.number_packs - (uint16_t)packs_reserved;
                r.quantity.amount = new_price;
            });

            break;
        }
        else {
            // always delete the reservation because it was either redeemed or not paid
            preorder = index.erase(preorder);
        }

        loop_count--;
    }
}

void aliensale::refundpreord(uint64_t preorder_id) {
    require_auth(get_self());

    auto preorder = _preorders.find(preorder_id);
    check(preorder != _preorders.end(), "Pre-order not found");

    // check the auction has ended
    auto auction = _auctions.find(preorder->auction_id);
    check(auction != _auctions.end(), "Auction is invalid");
    check(auction->pack.quantity.amount == 0, "Auction has not completed");

    check(preorder->quantity.symbol == symbol{symbol_code{"WAX"}, 8}, "Can only refund WAX sales");

    string memo = "Alien Worlds Pre-Order Refund";
    action(
        permission_level{get_self(), "xfer"_n},
        "eosio.token"_n, "transfer"_n,
        make_tuple(get_self(), preorder->account, preorder->quantity, memo)
    ).send();

    _preorders.erase(preorder);
}

void aliensale::swap(name buyer, asset quantity, checksum256 tx_id) {
    require_auth(get_self());
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

void aliensale::addethswap(checksum160 eth_address, asset quantity) {
    require_auth(get_self());

    auto swp_idx = _ethswaps.get_index<"byethaddr"_n>();
    auto swap = swp_idx.find(to_checksum256(eth_address));
    check(swap == swp_idx.end(), "Address already loaded");

    _ethswaps.emplace(get_self(), [&](auto &e){
        e.ethswap_id = _ethswaps.available_primary_key();
        e.eth_address = eth_address;
        e.quantity = quantity;
    });
}

void aliensale::redeemswap(uint64_t ethswap_id, checksum160 eth_address, name address) {
    require_auth(get_self());

    auto     size   = transaction_size();
    char *   buffer = (char *)(512 < size ? malloc(size) : alloca(size));
    uint32_t read   = read_transaction(buffer, size);
    check(size == read, "ERR::READ_TRANSACTION_FAILED::read_transaction failed");
    checksum256 tr_id = sha256(buffer, read);

    auto ethswap = _ethswaps.find(ethswap_id);
    check(ethswap != _ethswaps.end(), "Swap not found");
    check(ethswap->eth_address == eth_address, "ETH address does not match");
    check(!ethswap->complete, "Swap is already complete");

    _ethswaps.modify(ethswap, get_self(), [&](auto &e){
        e.tx_id = tr_id;
        e.complete = true;
    });

    // send the pack tokens out
    auto quantity = ethswap->quantity;
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
        make_tuple(get_self(), address, pack_to_send.quantity, memo)
    ).send();
}

void aliensale::reqrefund(name wax_address, string refund_address) {
    require_auth(wax_address);
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

void aliensale::clearsales() {
    require_auth(get_self());

    auto sale = _sales.begin();
    while (sale != _sales.end()){
        sale = _sales.erase(sale);
    }
}

void aliensale::clearpreord() {
    require_auth(get_self());

    auto preorder = _preorders.begin();
    while (preorder != _preorders.end()){
        preorder = _preorders.erase(preorder);
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

uint32_t aliensale::current_period(uint64_t auction_id) {
    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    uint32_t time_now = current_time_point().sec_since_epoch();
    check(time_now >= auction->start_time.sec_since_epoch(), "Auction has not started yet");
    uint32_t time_into_sale = time_now - auction->start_time.sec_since_epoch();

    auto start_price = auction->start_price;
    uint32_t cycle_length = auction->period_length + auction->break_length;
    uint32_t remainder = time_into_sale % cycle_length;
    uint32_t period_number = (time_into_sale - remainder) / cycle_length;

    if (period_number > auction->period_count) {
        period_number = auction->period_count;
    }

    print("\nPeriod number ", period_number);

    return period_number;
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

    if (period_number > auction->period_count) {
        period_number = auction->period_count;
    }
    // we are in the break period
    if (period_number < auction->period_count){
        check(remainder <= auction->period_length, "Auction is in a rest period");
    }

    print("\nPeriod number ", period_number);

    return auction_price_from_period(auction_id, period_number, qty);
}

uint64_t aliensale::auction_price_from_period(uint64_t auction_id, uint32_t period_number, uint8_t qty) {
    auto auction = _auctions.find(auction_id);
    check(auction != _auctions.end(), "Auction not found");

    uint64_t price = auction->start_price;
    if (period_number >= 1){
        price -= auction->first_step;
        price -= (period_number - 1) * auction->price_step;
    }

    return price * qty;
}
