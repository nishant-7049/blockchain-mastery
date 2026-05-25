// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error ZeroAddress();
error ZeroValue();
error AuctionIdDoesNotExists();
error TransferFailed();
error AuctionNotActive();
error LowBidAttempt(uint256 currentPrice);
error AuctionDoesNotExists();
error Unauthorized();
error AlreadyInactive();
error InvalidPrice(uint256 floorPrice, uint256 startingPrice);

contract DutchAuction {

    event AuctionCreated(address indexed sender, Auction auction);
    event AuctionSold(uint256 indexed auctionId, address indexed buyer, uint256 price);
    event AuctionCancelled(uint256 indexed auctionId);

    struct Auction {
        address sender;
        address nftContract;
        uint256 tokenId;
        uint256 startingPrice;
        uint256 floorPrice;
        uint256 discountRate;
        uint256 startTime;
        bool active;
        bool exists;
    }

    uint256 public nextAuction;
    mapping(uint256 => Auction) public auctions;


    modifier notZeroAddress(address contractAddress) {
        if(contractAddress == address(0)) revert ZeroAddress();
        _;
    }

    modifier notZeroValue(uint256 value) {
        if(value == 0) revert ZeroValue();
        _;
    }

    function createAuction(address _nftContract, uint256 _tokenId, uint256 _startingPrice, uint256 _floorPrice, uint256 _discountRate) external notZeroAddress(_nftContract) notZeroValue(_startingPrice) notZeroValue(_discountRate) {
        if(_floorPrice >= _startingPrice) revert InvalidPrice(_floorPrice, _startingPrice);
        Auction memory newAuction = Auction({
            sender: msg.sender,
            nftContract: _nftContract,
            tokenId: _tokenId,
            startingPrice: _startingPrice,
            floorPrice: _floorPrice,
            discountRate: _discountRate,
            startTime: block.timestamp,
            active: true,
            exists: true
        });

        auctions[nextAuction++] = newAuction;
        IERC721(_nftContract).transferFrom(msg.sender, address(this), _tokenId);

        emit AuctionCreated(msg.sender, newAuction);
    }

    function maxValue(uint256 value1, uint256 value2) internal pure returns(uint256) {
        if(value1 > value2) return value1;
        return value2;

    }

    function buy(uint256 auctionId) external payable {
        if(msg.value == 0 ) revert ZeroValue();
        Auction storage currentAuction = auctions[auctionId];
        if(!currentAuction.exists) revert AuctionIdDoesNotExists();
        if(!currentAuction.active) revert AuctionNotActive();

        uint256 discount = currentAuction.discountRate * (block.timestamp - currentAuction.startTime);
        uint256 currentPrice = discount >= currentAuction.startingPrice
            ? currentAuction.floorPrice
            : currentAuction.startingPrice - discount;
        uint256 effectivePrice = maxValue(currentPrice, currentAuction.floorPrice);
        if(effectivePrice <= msg.value) {
            currentAuction.active = false;
            if( msg.value - effectivePrice > 0 ){
                (bool ok, ) = payable(msg.sender).call{value: msg.value - effectivePrice}("");
                if(!ok) revert TransferFailed();
            }
                (bool ok2, ) = payable(currentAuction.sender).call{value: effectivePrice}(""); 
                if(!ok2) revert TransferFailed();
            IERC721(currentAuction.nftContract).transferFrom(address(this), msg.sender, currentAuction.tokenId);
        }else {
            revert LowBidAttempt(effectivePrice);
        }       

        emit AuctionSold(auctionId, msg.sender, effectivePrice);
    }

    function cancel(uint256 auctionId) external {
        if(!auctions[auctionId].exists) revert AuctionDoesNotExists();
        if(auctions[auctionId].sender != msg.sender) revert Unauthorized();

        if(!auctions[auctionId].active) revert AlreadyInactive();

        auctions[auctionId].active = false;

        IERC721(auctions[auctionId].nftContract).transferFrom(address(this), auctions[auctionId].sender, auctions[auctionId].tokenId);

        emit AuctionCancelled(auctionId);
    }

    function getPrice(uint256 auctionId) external view returns(uint256) {
        
        Auction memory currentAuction = auctions[auctionId];
        if(!currentAuction.exists) revert AuctionDoesNotExists(); 
        uint256 discount = currentAuction.discountRate * (block.timestamp - currentAuction.startTime);
  uint256 currentPrice = discount >= currentAuction.startingPrice
      ? currentAuction.floorPrice
      : currentAuction.startingPrice - discount;
  return maxValue(currentPrice, currentAuction.floorPrice);
    } 
}