#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <eosio/transaction.hpp>

using namespace eosio;
using namespace std;

namespace alienworlds {
    class [[eosio::contract("aliensale")]] aliensale : public contract {

    private:
        struct [[eosio::table("sales")]] sale_item {
            uint64_t               sale_id;
            uint64_t               address_id;
            name                   native_address;
            string                 foreign_address;
            vector<extended_asset> items;
            uint64_t               price; // in foreign satoshis / wei
            time_point_sec         sale_time;
            bool                   completed = false;
            string                 completed_tx_id;

            uint64_t primary_key() const { return sale_id; }
        };
        typedef multi_index<"sales"_n, sale_item> sales_table;


        /* Records previously generated foreign addresses to send to */
        struct [[eosio::table("addresses")]] address_item {
            uint64_t       address_id;
            symbol_code    foreign_symbol;
            string         foreign_address;

            uint64_t primary_key() const { return address_id; }
            uint64_t bysym() const { return foreign_symbol.raw(); }
        };
        typedef multi_index<"addresses"_n, address_item> addresses_table;


        addresses_table _addresses;
        sales_table     _sales;

        uint64_t compute_price(vector<extended_asset> items);

    public:
        using contract::contract;

        aliensale(name s, name code, datastream<const char *> ds);

        /* Add addresses to the unused addresses table (ETH) */
        [[eosio::action]] void addaddress(uint64_t address_id, symbol currency, string address);

        /* Create a sale for pack tokens, using the provided items and currency */
        [[eosio::action]] void createsale(name native_address, vector<extended_asset> items, symbol currency);

        /* Records a payment for a particular sale, this is sent by an off-chain oracle */
        [[eosio::action]] void payment(uint64_t sale_id, string tx_id);

        /* Admin only during development */
        [[eosio::action]] void clearsales();
    };
}

