#include "aliensale.hpp"

using namespace alienworlds;

aliensale::aliensale(name s, name code, datastream<const char *> ds) : contract(s, code, ds),
                                                                       _addresses(get_self(), get_self().value),
                                                                       _sales(get_self(), get_self().value),
                                                                       _packs(get_self(), get_self().value) {}


void aliensale::addpack(uint64_t pack_id, extended_asset pack_asset, asset native_price) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack == _packs.end(), "Pack already exists with this ID");

    _packs.emplace(get_self(), [&](auto &p){
        p.pack_id      = pack_id;
        p.pack_asset   = pack_asset;
        p.native_price = native_price;
    });
}

void aliensale::editpack(uint64_t pack_id, extended_asset pack_asset, asset native_price) {
    require_auth(get_self());

    auto pack = _packs.find(pack_id);
    check(pack != _packs.end(), "Pack with this ID not found");

    _packs.modify(pack, get_self(), [&](auto &p){
        p.pack_asset   = pack_asset;
        p.native_price = native_price;
    });
}

void aliensale::addaddress(uint64_t address_id, symbol currency, string address) {
    require_auth(get_self());

    _addresses.emplace(get_self(), [&](auto &a){
        a.address_id      = address_id;  // normally the hd derivation path
        a.foreign_symbol  = currency.code();
        a.foreign_address = address;
    });
}

void aliensale::createsale(name native_address, vector<extended_asset> items, symbol currency) {
    require_auth(native_address);

    // get the next available foreign address
    auto addr = _addresses.begin();
    while (addr != _addresses.end() && addr->foreign_symbol != currency.code()){
        addr++;
    }
    check(addr != _addresses.end(), "Could not find payment address");

    string foreign_address = addr->foreign_address;


    _sales.emplace(native_address, [&](auto &s){
        s.sale_id         = _sales.available_primary_key();
        s.address_id      = addr->address_id;
        s.native_address  = native_address;
        s.foreign_address = foreign_address;
        s.items           = items;
        s.price           = compute_price(items, "waxpeth"_n);
        s.sale_time       = time_point(current_time_point().time_since_epoch());
        s.completed       = false;
    });

    // remove the address
    _addresses.erase(addr);
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


// Private

uint64_t aliensale::compute_price(vector<extended_asset> items, name pair) {
    auto _datapoints = datapointstable(DELPHI_CONTRACT, pair.value);
    auto _pairs = pairstable(DELPHI_CONTRACT, DELPHI_CONTRACT.value);

    auto pair_itr = _pairs.find(pair.value);
    check(pair_itr != _pairs.end(), "Pair not found");

    auto dpi = _datapoints.get_index<"timestamp"_n>();
    auto last_dp = dpi.rbegin();

    uint64_t precision = pair_itr->quoted_precision;
    uint64_t base_median = last_dp->median;

    uint64_t satoshi_price = base_median * (uint64_t)pow(10.0, (double)precision);

    auto pack_ind = _packs.get_index<"bypack"_n>();

    uint64_t total = 0;
    for (auto item: items){
        // get price from sales packs table
        auto pack = pack_ind.find(pack_item::extended_asset_id(item));
        check(pack != pack_ind.end(), "Pack not found");

        double pack_price = (double)pack->native_price.amount / pow(10, (double)pack->native_price.symbol.precision());

        total += (uint64_t)(pack_price * (double)satoshi_price);
    }

    return total;
}
