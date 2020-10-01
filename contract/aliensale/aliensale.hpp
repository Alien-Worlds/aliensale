#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <eosio/crypto.hpp>
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
        /* Indicates a foreign sale invoice, native sales are done using `deposit` and `buy` */
        struct [[eosio::table("invoices")]] invoice_item {
            uint64_t               invoice_id;
            uint64_t               auction_id;
            uint64_t               address_id;
            name                   native_address;
            string                 foreign_address;
            foreign_symbol         invoice_currency;
            uint8_t                qty;
            uint64_t               price; // in foreign satoshis / wei
            time_point_sec         invoice_time;
            bool                   completed = false;
            string                 completed_tx_id;

            uint64_t primary_key() const { return invoice_id; }
            uint64_t by_chain() const { return invoice_currency.chain.value; }
        };
        typedef multi_index<"invoices"_n, invoice_item,
                      indexed_by<"bychain"_n, const_mem_fun<invoice_item, uint64_t, &invoice_item::by_chain>>
                    > invoices_table;


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


      inline static checksum256 to_checksum256(checksum160 in){
          checksum256 out(in.get_array());
          return out;
      }
      /* ETH swaps, maintains a list of whitelisted addresses */
      struct [[eosio::table("ethswaps")]] ethswap_item {
        uint64_t     ethswap_id;
        checksum160  eth_address;
        checksum256  tx_id;
        asset        quantity;
        bool         complete;

        uint64_t    primary_key() const { return ethswap_id; }
        checksum256 by_tx_id() const { return tx_id; }
        checksum256 by_eth_addr() const { return to_checksum256(eth_address); }
      };
      typedef multi_index<"ethswaps"_n, ethswap_item,
          indexed_by<"bytxid"_n, const_mem_fun<ethswap_item, checksum256, &ethswap_item::by_tx_id> >,
          indexed_by<"byethaddr"_n, const_mem_fun<ethswap_item, checksum256, &ethswap_item::by_eth_addr> >
              > ethswaps_table;


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
            string                 metadata;
            uint8_t                number_cards;

            uint64_t primary_key() const { return pack_id; }
            uint128_t by_pack() const { return extended_asset_id(pack_asset); };

            static uint128_t extended_asset_id(extended_asset a) {
                return (uint128_t{a.contract.value} << 64) + a.quantity.symbol.code().raw();
            }
        };
        typedef multi_index<"packs"_n, pack_item, indexed_by<"bypack"_n,
            const_mem_fun<pack_item, uint128_t, &pack_item::by_pack> > > packs_table;


        /* A dutch auction period, deals with the sale of a single pack for a single price */
        struct [[eosio::table("auctions")]] auction_item {
            uint64_t       auction_id;
            extended_asset pack;           // the actual pack as well as the quantity currently available for sale
            time_point     start_time;
            foreign_symbol price_symbol;   // the currency this auction is taking place in (eg. WAX, ETH)
            uint64_t       start_price;    // always in satoshis of the currency
            uint32_t       period_length;  // length of time for a particular sale
            uint32_t       break_length;   // short break between sale periods
            uint64_t       first_step;     // drop in price for first period
            uint64_t       price_step;     // drop in price for each period after first
            uint8_t        period_count;   // number of periods, price will no longer drop after this

            uint64_t primary_key() const { return auction_id; }
            uint128_t by_pack() const { return extended_asset_id(pack); };

            static uint128_t extended_asset_id(extended_asset a) {
                return (uint128_t{a.contract.value} << 64) + a.quantity.symbol.code().raw();
            }
        };
        typedef multi_index<"auctions"_n, auction_item, indexed_by<"bypack"_n,
            const_mem_fun<auction_item, uint128_t, &auction_item::by_pack> > > auctions_table;


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

        // Local instances
        addresses_table _addresses;
        invoices_table  _invoices;
        auctions_table  _auctions;
        packs_table     _packs;
        deposits_table  _deposits;
        swaps_table     _swaps;
        ethswaps_table  _ethswaps;

        // uint64_t compute_price(vector<extended_asset> items, extended_symbol settlement_currency, name foreign_chain);
        std::string bytetohex(unsigned char *data, int len);
        uint64_t auction_price(uint64_t auction_id, uint8_t qty);

    public:
        using contract::contract;

        aliensale(name s, name code, datastream<const char *> ds);

        /* Add pack for sale */
        [[eosio::action]] void addpack(uint64_t pack_id, extended_asset pack_asset, string metadata, uint8_t number_cards);

        /* Edit pack for sale */
        [[eosio::action]] void editpack(uint64_t pack_id, string metadata, uint8_t number_cards);

        /* Delete pack */
        [[eosio::action]] void delpack(uint64_t pack_id);

        /* Add auction */
        [[eosio::action]] void addauction(extended_asset pack, time_point start_time, foreign_symbol price_symbol, uint64_t start_price, uint32_t period_length, uint32_t break_length, uint64_t first_step, uint64_t price_step, uint8_t period_count);

        /* Delete auction */
        [[eosio::action]] void delauction(uint64_t auction_id);

        /* Add addresses to the unused addresses table (ETH/EOS) - for EOS, this would be a memo reference, not address */
        [[eosio::action]] void addaddress(uint64_t address_id, name foreign_chain, string address);

        /* Create an invoice for an auction */
        [[eosio::action]] void newinvoice(name native_address, uint64_t auction_id, uint8_t qty);

        /* Logs an invoice which can be read by the client in action traces */
        [[eosio::action]] void loginvoice(name native_address, uint64_t invoice_id, uint64_t foreign_price, string foreign_address, extended_symbol settlement_currency);

        /* Remove an invoice entry */
        [[eosio::action]] void delinvoice(uint64_t invoice_id);

        /* Records a payment for a particular sale, this is sent by an off-chain oracle */
        [[eosio::action]] void payment(uint64_t invoice_id, string tx_id);

        /* Buy using deposited funds using native token */
        [[eosio::action]] void buy(name buyer, uint64_t auction_id, uint8_t qty);

        /* Swap from EOS, will be called by the watcher script */
         [[eosio::action]] void swap(name buyer, asset quantity, checksum256 tx_id);

        /* Swap from ETH, account must exist in the ethswap table */
         [[eosio::action]] void addethswap(checksum160 eth_address, asset quantity);

         /* Redeem, called by our script */
        [[eosio::action]] void redeemswap(uint64_t ethswap_id, checksum160 eth_address, name address);

        /* Receive transfers for payments in native token */
        [[eosio::on_notify("eosio.token::transfer")]] void transfer(name from, name to, asset quantity, string memo);

        /* Admin only during development */
        [[eosio::action]] void clearinvs();
        [[eosio::action]] void clearpacks();
        [[eosio::action]] void clearauction();
        [[eosio::action]] void clearswaps();
        [[eosio::action]] void clearaddress();
    };
}

