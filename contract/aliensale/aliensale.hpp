#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <eosio/transaction.hpp>
#include <math.h>

using namespace eosio;
using namespace std;

#define DELPHI_CONTRACT "delphioracle"_n

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


        /* Records previously generated foreign addresses to send to */
        struct [[eosio::table("packs")]] pack_item {
            uint64_t       pack_id;
            extended_asset pack_asset;
            asset          native_price;

            uint64_t primary_key() const { return pack_id; }
            uint128_t by_pack() const { return extended_asset_id(pack_asset); };

            static uint128_t extended_asset_id(extended_asset a) {
                return (uint128_t{a.contract.value} << 64) + a.quantity.symbol.code().raw();
            }
        };
        typedef multi_index<"packs"_n, pack_item, indexed_by<"bypack"_n,
            const_mem_fun<pack_item, uint128_t, &pack_item::by_pack> > > packs_table;


        // External tables from delphioracle
        typedef uint16_t asset_type;
        //Holds the last datapoints_count datapoints from qualified oracles
        struct datapoints {
            uint64_t   id;
            name       owner;
            uint64_t   value;
            uint64_t   median;
            time_point timestamp;

            uint64_t primary_key() const {return id;}
            uint64_t by_timestamp() const {return timestamp.elapsed.to_seconds();}
            uint64_t by_value() const {return value;}
        };
        typedef eosio::multi_index<"datapoints"_n, datapoints,
            indexed_by<"value"_n, const_mem_fun<datapoints, uint64_t, &datapoints::by_value>>,
            indexed_by<"timestamp"_n, const_mem_fun<datapoints, uint64_t, &datapoints::by_timestamp>>> datapointstable;


        //Holds the list of pairs
        struct pairs {

            bool active = false;
            bool bounty_awarded = false;
            bool bounty_edited_by_custodians = false;

            name proposer;
            name name;

            asset bounty_amount;

            std::vector<eosio::name> approving_custodians;
            std::vector<eosio::name> approving_oracles;

            symbol base_symbol;
            asset_type base_type;
            eosio::name base_contract;

            symbol quote_symbol;
            asset_type quote_type;
            eosio::name quote_contract;

            uint64_t quoted_precision;

            uint64_t primary_key() const {return name.value;}

        };
        typedef eosio::multi_index<"pairs"_n, pairs> pairstable;


        // Local instances
        addresses_table _addresses;
        sales_table     _sales;
        packs_table     _packs;

        uint64_t compute_price(vector<extended_asset> items, name pair);

    public:
        using contract::contract;

        aliensale(name s, name code, datastream<const char *> ds);

        /* Add pack for sale */
        [[eosio::action]] void addpack(uint64_t pack_id, extended_asset pack_asset, asset native_price);

        /* Edit pack for sale */
        [[eosio::action]] void editpack(uint64_t pack_id, extended_asset pack_asset, asset native_price);

        /* Add addresses to the unused addresses table (ETH/EOS) - for EOS, this would be a memo reference, not address */
        [[eosio::action]] void addaddress(uint64_t address_id, symbol currency, string address);

        /* Create a sale for pack tokens, using the provided items and currency */
        [[eosio::action]] void createsale(name native_address, vector<extended_asset> items, symbol currency);

        /* Records a payment for a particular sale, this is sent by an off-chain oracle */
        [[eosio::action]] void payment(uint64_t sale_id, string tx_id);

        /* Admin only during development */
        [[eosio::action]] void clearsales();
        [[eosio::action]] void clearpacks();
    };
}

