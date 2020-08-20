#include "aliensale.hpp"

using namespace alienworlds;

aliensale::aliensale(name s, name code, datastream<const char *> ds) : contract(s, code, ds),
                                                                       _addresses(get_self(), get_self().value),
                                                                       _sales(get_self(), get_self().value),
                                                                       _packs(get_self(), get_self().value),
                                                                       _deposits(get_self(), get_self().value),
                                                                       _swaps(get_self(), get_self().value) {}


void aliensale::addpack(uint64_t pack_id, extended_asset pack_asset, extended_asset quote_price, vector<foreign_symbol> sale_symbols, string metadata) {
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
        p.quote_price  = quote_price;
        p.sale_symbols = sale_symbols;
        p.metadata     = metadata;
        p.allow_sale   = false;
    });
}

void aliensale::editpack(uint64_t pack_id, extended_asset pack_asset, extended_asset quote_price, vector<foreign_symbol> sale_symbols, string metadata) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack with this ID not found");

    _packs.modify(pack, get_self(), [&](auto &p){
        p.pack_asset   = pack_asset;
        p.quote_price  = quote_price;
        p.sale_symbols = sale_symbols;
        p.metadata     = metadata;
    });
}

void aliensale::delpack(uint64_t pack_id) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack not found");

    _packs.erase(pack);
}

void aliensale::setallowed(uint64_t pack_id, bool is_allowed) {
    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack not found");

    _packs.modify(pack, same_payer, [&](auto &p){
        p.allow_sale = is_allowed;
    });
}

void aliensale::addaddress(uint64_t address_id, name foreign_chain, string address) {
    require_auth(get_self());

    _addresses.emplace(get_self(), [&](auto &a){
        a.address_id      = address_id;  // normally the hd derivation path
        a.foreign_chain   = foreign_chain;
        a.foreign_address = address;
    });
}

void aliensale::createsale(name native_address, vector<extended_asset> items, name foreign_chain, extended_symbol settlement_currency) {
    require_auth(native_address);

    // get the next available foreign address
    auto chain_idx = _addresses.get_index<"bychain"_n>();
    auto addr = chain_idx.begin();
    while (addr != chain_idx.end() && addr->foreign_chain != foreign_chain){
        addr++;
    }
    check(addr != chain_idx.end(), "Could not find payment address");

    string foreign_address = addr->foreign_address;

    uint64_t sale_id = _sales.available_primary_key();
    uint64_t foreign_price = compute_price(items, settlement_currency, foreign_chain);

    _sales.emplace(native_address, [&](auto &s){
        s.sale_id          = sale_id;
        s.address_id       = addr->address_id;
        s.native_address   = native_address;
        s.foreign_chain    = foreign_chain;
        s.foreign_address  = foreign_address;
        s.foreign_contract = settlement_currency.get_contract();
        s.foreign_symbol   = settlement_currency.get_symbol();
        s.items            = items;
        s.price            = foreign_price;
        s.sale_time        = time_point(current_time_point().time_since_epoch());
        s.completed        = false;
    });

    // remove the address
    chain_idx.erase(addr);

    // log sale
    action(
        permission_level{get_self(), "log"_n},
        get_self(), "logsale"_n,
        make_tuple(native_address, sale_id, foreign_price, foreign_address)
        ).send();
}

void aliensale::logsale(name native_address, uint64_t sale_id, uint64_t foreign_price, string foreign_address) {}

void aliensale::delsale(uint64_t sale_id) {
  require_auth(get_self());

    auto sale = _sales.find(sale_id);
    check(sale != _sales.end(), "Sale not found");

    _sales.erase(sale);
}

void aliensale::payment(uint64_t sale_id, string tx_id) {
    require_auth(get_self());

    auto sale = _sales.find(sale_id);
    check(sale != _sales.end(), "Sale not found");

    if (!sale->completed){
        for (auto item: sale->items){
            // send each transfer
            action(
                    permission_level{get_self(), "xfer"_n},
                    item.contract, "transfer"_n,
                    make_tuple(get_self(), sale->native_address, item.quantity, tx_id)
            ).send();
        }

        _sales.modify(sale, get_self(), [&](auto &s){
            s.completed       = true;
            s.completed_tx_id = tx_id;
        });
    }


}

void aliensale::transfer(name from, name to, asset quantity, string memo) {
    if (from == get_self() || to != get_self()){
        return;
    }

    auto deposit = _deposits.find(from.value);
    check(deposit == _deposits.end(), "You already have a deposit, please complete the previous sale");

    _deposits.emplace(get_self(), [&](auto &d){
        d.account  = from;
        d.quantity = quantity;
    });
}

void aliensale::buy(name buyer, uint64_t pack_id, uint8_t qty) {
    // check they have correct deposit and send out packs
    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack not found");

    auto deposit = _deposits.find(buyer.value);
    check(deposit != _deposits.end(), "Deposit not found");

    check(pack->quote_price.quantity.symbol == symbol{symbol_code{"WAX"}, 8}, "Please use createsale for non-native sales");

    auto pack_price = pack->quote_price.quantity * qty;
    check(pack_price == deposit->quantity, "Incorrect amount deposited");
    check(pack->allow_sale, "Sale not allowed");

    auto pack_asset = pack->pack_asset.quantity * qty;
    string memo = "Buying packs";

    action(
        permission_level{get_self(), "xfer"_n},
        pack->pack_asset.contract, "transfer"_n,
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

void aliensale::clearsales() {
    require_auth(get_self());

    auto sale = _sales.begin();
    while (sale != _sales.end()){
        sale = _sales.erase(sale);
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

uint64_t aliensale::compute_price(vector<extended_asset> items, extended_symbol settlement_currency, name foreign_chain) {

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
}
