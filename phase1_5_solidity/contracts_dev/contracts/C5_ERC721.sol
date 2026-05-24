// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error TokenDoesNotExists();
error ZeroAddress();
error Unauthorized();
error NoTokenFound();
error AlreadySameApprovalState(address operator, bool approved );
error FromNotOwner();
error NotApproved();
error TokenIdAlreadyExists();
error EmptyUri();

contract ERC721 {

    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    string public name;
    string public symbol;
    address public immutable owner;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => string) public _tokenURIs;

    constructor(string memory _name, string memory _symbol) {
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier notZeroAddress(address user) {
        if(user == address(0)) revert ZeroAddress();
        _;
    }

    function tokenURI(uint256 tokenId) external view returns(string memory) {
        string memory uri = _tokenURIs[tokenId];
        if(keccak256(bytes(uri)) == keccak256(bytes(""))) revert TokenDoesNotExists();
        return uri;
    }

    function approve(address to, uint256 tokenId) external notZeroAddress(to){

        if(ownerOf[tokenId] == address(0)) revert TokenDoesNotExists();
        if(ownerOf[tokenId] != msg.sender && !isApprovedForAll[ownerOf[tokenId]][msg.sender]) revert Unauthorized();
        
        getApproved[tokenId] = to;
        emit Approval(ownerOf[tokenId], to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external notZeroAddress(operator) {
        if(isApprovedForAll[msg.sender][operator] == approved) revert AlreadySameApprovalState(operator, approved);

        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) external notZeroAddress(from) notZeroAddress(to) {
        address currentOwner = ownerOf[tokenId];
        if(currentOwner == address(0)) revert TokenDoesNotExists();
        if(currentOwner != from) revert FromNotOwner();
        if(currentOwner != msg.sender && getApproved[tokenId] != msg.sender && !isApprovedForAll[from][msg.sender]) revert NotApproved();

        getApproved[tokenId] = address(0);
        ownerOf[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }

    function mint(address to, uint256 tokenId, string memory uri) external notZeroAddress(to) onlyOwner {
        if(ownerOf[tokenId] != address(0)) revert TokenIdAlreadyExists();
        if(keccak256(bytes(uri)) == keccak256(bytes(""))) revert EmptyUri();

        ownerOf[tokenId] = to;
        _tokenURIs[tokenId] = uri; 
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function burn(uint256 tokenId) external {
        if(ownerOf[tokenId] == address(0)) revert TokenDoesNotExists();
        if(ownerOf[tokenId] != msg.sender) revert Unauthorized();

        ownerOf[tokenId] = address(0);
        delete getApproved[tokenId];
        delete _tokenURIs[tokenId];
        balanceOf[msg.sender] -= 1;
        emit Transfer(msg.sender, address(0), tokenId);
    }
}