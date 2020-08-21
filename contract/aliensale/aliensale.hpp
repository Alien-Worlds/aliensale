#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <eosio/transaction.hpp>
#include <math.h>

using namespace eosio;
using namespace std;

/*
 * This contract is installed on the native chain and handles sales in the
 * native currency as well foreign currencies.
 *
 * Native sales are handled with a simple deposit-spend pattern, foreign sales
 * must register the sale and then the sale is completed by the monitoring
 * scripts running on the other chains
 *
 * Also handles swaps of vouchers from other chains with the swap action.
 */

#define DELPHI_CONTRACT "delphioracle"_n
#define SWAP_PACK_CONTRACT "pack.worlds"_n

namespace alienworlds {
    class [[eosio::contract("aliensale")]] aliensale : public contract {
    public:
        struct foreign_symbol {
            name   chain;
            name   contract;
            symbol symbol;
        };

    private:
        /* Indicates a foreign sale, native sales are done using `deposit` and `buy` */
        struct [[eosio::table("sales")]] sale_item {
            uint64_t               sale_id;
            uint64_t               address_id;
            name                   native_address;
            name                   foreign_chain;
            string                 foreign_address;
            name                   foreign_contract;
            symbol                 foreign_symbol;
            vector<extended_asset> items;
            uint64_t               price; // in foreign satoshis / wei
            time_point_sec         sale_time;
            bool                   completed = false;
            string                 completed_tx_id;

            uint64_t primary_key() const { return sale_id; }
            uint64_t by_chain() const { return foreign_chain.value; }
        };
        typedef multi_index<"sales"_n, sale_item, indexed_by<"bychain"_n,
            const_mem_fun<sale_item, uint64_t, &sale_item::by_chain> > > sales_table;


        /* Deposits when buying in native currency */
        struct [[eosio::table("deposits")]] deposit_item {
          name  account;
          asset quantity;

          uint64_t primary_key() const { return account.value; }
        };
        typedef multi_index<"deposits"_n, deposit_item> deposits_table;


        /* Swaps a voucher from foreign chain, record tx_id to prevent replays */
        struct [[eosio::table("swaps")]] swap_item {
          uint64_t    swap_id;
          name        account;
          checksum256 tx_id;
          asset       quantity;

          uint64_t    primary_key() const { return swap_id; }
          checksum256 by_tx_id() const { return tx_id; }
        };
        typedef multi_index<"swaps"_n, swap_item, indexed_by<"bytxid"_n,
            const_mem_fun<swap_item, checksum256, &swap_item::by_tx_id> > > swaps_table;


        /* Records previously generated foreign addresses to send to */
        struct [[eosio::table("addresses")]] address_item {
            uint64_t       address_id;
            name           foreign_chain;
            string         foreign_address;

            uint64_t primary_key() const { return address_id; }
            uint64_t by_chain() const { return foreign_chain.value; }
        };
        typedef multi_index<"addresses"_n, address_item, indexed_by<"bychain"_n,
            const_mem_fun<address_item, uint64_t, &address_item::by_chain> > > addresses_table;


        /* Records previously generated foreign addresses to send to */
        struct [[eosio::table("packs")]] pack_item {
            uint64_t               pack_id;
            extended_asset         pack_asset;
            extended_asset         quote_price;
            string                 metadata;
            vector<foreign_symbol> sale_symbols;
            uint8_t                number_cards;
            bool                   allow_sale;

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
        deposits_table  _deposits;
        swaps_table     _swaps;

        uint64_t compute_price(vector<extended_asset> items, extended_symbol settlement_currency, name foreign_chain);

    public:
        using contract::contract;

        aliensale(name s, name code, datastream<const char *> ds);

        /* Add pack for sale */
        [[eosio::action]] void addpack(uint64_t pack_id, extended_asset pack_asset, extended_asset quote_price, vector<foreign_symbol> sale_symbols, string metadata, uint8_t number_cards);

        /* Edit pack for sale */
        [[eosio::action]] void editpack(uint64_t pack_id, extended_asset pack_asset, extended_asset quote_price, vector<foreign_symbol> sale_symbols, string metadata, uint8_t number_cards);

        /* Delete pack */
        [[eosio::action]] void delpack(uint64_t pack_id);

        /* Add addresses to the unused addresses table (ETH/EOS) - for EOS, this would be a memo reference, not address */
        [[eosio::action]] void addaddress(uint64_t address_id, name foreign_chain, string address);

        /* Create a sale for pack tokens, using the provided items and currency */
        [[eosio::action]] void createsale(name native_address, vector<extended_asset> items, name foreign_chain, extended_symbol settlement_currency);

        /* Logs a sale which can be read by the client in action traces */
        [[eosio::action]] void logsale(name native_address, uint64_t sale_id, uint64_t foreign_price, string foreign_address, extended_symbol settlement_currency);

        /* Remove a sale entry */
        [[eosio::action]] void delsale(uint64_t sale_id);

        /* Records a payment for a particular sale, this is sent by an off-chain oracle */
        [[eosio::action]] void payment(uint64_t sale_id, string tx_id);

        /* Buy using deposited funds using native token */
        [[eosio::action]] void buy(name buyer, uint64_t pack_id, uint8_t qty);

        /* Swap from another chain (called by trusted script) */
        [[eosio::action]] void swap(name buyer, asset quantity, checksum256 tx_id);

        /* Marks the sale of the pack as allowed */
        [[eosio::action]] void setallowed(uint64_t pack_id, bool is_allowed);

        /* Receive transfers for payments in native token */
        [[eosio::on_notify("eosio.token::transfer")]] void transfer(name from, name to, asset quantity, string memo);

        /* Admin only during development */
        [[eosio::action]] void clearsales();
        [[eosio::action]] void clearpacks();
        [[eosio::action]] void clearswaps();
        [[eosio::action]] void clearaddress();
    };
}

