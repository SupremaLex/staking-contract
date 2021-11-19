pragma solidity 0.8.4;

contract Ownable
{
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner()
    {
        require(_owner == msg.sender, "Ownable: only owner can call this function");
        _;
    }

    constructor()
    {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    function getOwner() public view returns(address)
    {
        return _owner;
    }

    function renounceOwnership() public onlyOwner
    {
        _owner = address(0);
        emit OwnershipTransferred(_owner, address(0));
    }


    function transferOwnership(address newOwner) public onlyOwner
    {
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal
    {
        _owner = newOwner;
        emit OwnershipTransferred(_owner, newOwner);
    }
}