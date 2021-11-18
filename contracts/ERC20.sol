pragma solidity 0.8.4;

import "./Ownable.sol";
import "./Stakeable.sol";

contract Token is Ownable, Stakeable
{

  uint private _totalSupply;
  uint8 private _decimals;
  string private _symbol;
  string private _name;

  struct Balance
  {
      uint256 available;
      uint256 claimed;
      uint256 locked;
  }
  
  mapping (address => Balance) private _balances;
  mapping (address => mapping (address => uint256)) private _allowances;

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  constructor(string memory token_name, string memory short_symbol, uint8 token_decimals, uint256 token_totalSupply)
  {
      _name = token_name;
      _symbol = short_symbol;
      _decimals = token_decimals;
      _totalSupply = token_totalSupply;

      _balances[msg.sender].available = _totalSupply;

      emit Transfer(address(0), msg.sender, _totalSupply);
  }

  function decimals() external view returns (uint8)
  {
    return _decimals;
  }

  function symbol() external view returns (string memory)
  {
    return _symbol;
  }

  function name() external view returns (string memory)
  {
    return _name;
  }

  function totalSupply() external view returns (uint256)
  {
    return _totalSupply;
  }

  function balanceOf(address account) external view returns (uint256)
  {
    return _balances[account].available;
  }
  
  function lockedBalanceOf(address account) external view returns (uint256)
  {
    return _balances[account].locked;
  }
  
  function claimedBalanceOf(address account) external view returns (uint256)
  {
    return _balances[account].claimed;
  }
  
  function _mint(address account, uint256 amount) internal
  {
    require(account != address(0), "Token: cannot mint to zero address");

    _totalSupply += amount;
    _balances[account].available += amount;
    emit Transfer(address(0), account, amount);
  }

  function mint(address account, uint256 amount) public onlyOwner returns(bool)
  {
    _mint(account, amount);
    return true;
  }

  function transfer(address recipient, uint256 amount) external returns (bool)
  {
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  function _transfer(address sender, address recipient, uint256 amount) internal
  {
    require(sender != address(0), "Token: transfer from zero address");
    require(recipient != address(0), "Token: transfer to zero address");
    require(_balances[sender].available >= amount, "Token: cant transfer more than your account holds");

    _balances[sender].available -= amount;
    _balances[recipient].available += amount;

    emit Transfer(sender, recipient, amount);
  }

   function allowance(address owner, address spender) external view returns(uint256)
   {
     return _allowances[owner][spender];
   }

   function approve(address spender, uint256 amount) external returns (bool)
   {
     _approve(msg.sender, spender, amount);
     return true;
   }


    function _approve(address owner, address spender, uint256 amount) internal
    {
      require(owner != address(0), "Token: approve cannot be done from zero address");
      require(spender != address(0), "Token: approve cannot be to zero address");
      _allowances[owner][spender] = amount;

      emit Approval(owner,spender,amount);
    }

    function transferFrom(address spender, address recipient, uint256 amount) external returns(bool)
    {
      require(_allowances[spender][msg.sender] >= amount, "Token: You cannot spend that much on this account");
      _transfer(spender, recipient, amount);
      _approve(spender, msg.sender, _allowances[spender][msg.sender] - amount);
      return true;
    }
    
    function stake(uint256 amount) external
    {
      require(amount <= _balances[msg.sender].available, "Token: Cannot stake more than you own");
      _stake(amount);
      _balances[msg.sender].available -= amount;
      _balances[msg.sender].locked += amount;
    }
    
    function claim() external
    {
        _balances[msg.sender].claimed = _balances[msg.sender].locked;
        _balances[msg.sender].locked = 0;
        _claim();
    }
    
    function claimAndWithdraw(uint amount) external
    {
        _claimAndWithdraw(amount);
        _balances[msg.sender].claimed = amount;
        _balances[msg.sender].locked -= amount;
    }
    
    function withdraw() external
    {
       (uint256 amount, uint256 reward) = _withdraw();
      _balances[msg.sender].available += amount;
      _balances[msg.sender].claimed -= amount;
      _mint(msg.sender, reward);
    }

}