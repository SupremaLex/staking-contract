pragma solidity 0.8.4;

contract Stakeable
{
    
    struct Stake
    {
        uint256 amount;
        uint256 since;
        uint256 claimedAmount;
        uint256 claimedTime;
    }
    
    struct Stakeholder
    {
        address user;
        Stake[] stakes;
    }
    
    Stakeholder[] internal stakeholders;
    mapping(address => uint256) internal stakes;
    event Staked(address indexed user, uint256 amount, uint256 index, uint256 timestamp);
    event Claimed(uint256 timestamp);
    event Withdrawed(uint256 amount, uint256 reward, uint256 timestamp);
    
    uint256 internal APY = 150;
    
    constructor()
    {
        stakeholders.push();
    }
    
    function _addStakeholder(address staker) internal returns (uint256)
    {
        stakeholders.push();
        uint256 userIndex = stakeholders.length - 1;
        stakeholders[userIndex].user = staker;
        stakes[staker] = userIndex;
        return userIndex; 
    }
    
    function _stake(uint256 _amount) internal
    {
        require(_amount > 0, "Cannot stake nothing");
        
        uint256 index = stakes[msg.sender];
        uint256 timestamp = block.timestamp;
        if(index == 0)
        {
            index = _addStakeholder(msg.sender);
        }

        stakeholders[index].stakes.push(Stake(_amount, timestamp, 0, 0));
        emit Staked(msg.sender, _amount, index, timestamp);
    }
    
    function calculateStakeReward(Stake memory _current_stake) internal view returns (uint256)
    {
          return (((_current_stake.claimedTime - _current_stake.since) / 365 days) * _current_stake.claimedAmount) / APY;
    }
    
    function getStakeAmount(Stake[] memory user_stakes) pure internal returns (uint256)
    {
        uint256 amount = 0;
        for (uint i = 0; i < user_stakes.length; ++i)
        {
            amount += user_stakes[i].amount;
        }
        return amount;
    }
    
    function removeZeroStakes(Stake[] storage user_stakes) internal
    {
        // Order of stakes is not preserved
        uint shift = 0;
        for (uint i = 0; i < user_stakes.length; ++i)
        {
            if (user_stakes[i].amount == 0 && i < user_stakes.length - shift)
            {
                shift++;
                for (;i != user_stakes.length - shift; ++shift)
                {
                    if (user_stakes[user_stakes.length - shift].amount != 0) 
                    {
                        Stake memory element = user_stakes[i];
                        user_stakes[i] = user_stakes[user_stakes.length - shift];
                        user_stakes[user_stakes.length - shift] = element;
                        break;
                    }
                }
            }
        }
        
        for (uint i = 0; i < shift; ++i)
        {
            user_stakes.pop();
        }
    }
    
    function _withdraw() internal returns (uint256, uint256)
    {
        uint256 user_index = stakes[msg.sender];
        Stake[] storage current_stakes = stakeholders[user_index].stakes;
        uint256 withdrawed = 0;
        uint256 reward = 0;
        for (uint i = 0; i < current_stakes.length; ++i)
        {
            if (current_stakes[i].claimedTime == 0 || block.timestamp - current_stakes[i].claimedTime < 1 days)
            {
                continue;
            }
            
            reward += calculateStakeReward(current_stakes[i]);
            withdrawed += current_stakes[i].claimedAmount;
            current_stakes[i].claimedAmount = 0;
            
            if (current_stakes[i].amount > 0)
            {
                current_stakes[i].since = current_stakes[i].claimedTime;
                current_stakes[i].claimedTime = 0;
            }
        }
        
        removeZeroStakes(stakeholders[user_index].stakes);
        emit Withdrawed(withdrawed, reward, block.timestamp);
        return (withdrawed, reward);
     }
    
    function _claim() internal
    {
        uint256 user_index = stakes[msg.sender];
        Stake[] storage current_stakes = stakeholders[user_index].stakes;
        for (uint i = 0; i < current_stakes.length; ++i) {
            if (current_stakes[i].claimedTime > 0)
            {
                continue;
            }
            current_stakes[i].claimedTime = block.timestamp;
            current_stakes[i].claimedAmount = current_stakes[i].amount;
            current_stakes[i].amount = 0;
        }
        emit Claimed(block.timestamp);
    }
    
    function _claimAndWithdraw(uint256 amount) internal
    {
        uint256 user_index = stakes[msg.sender];
        Stake[] storage current_stakes = stakeholders[user_index].stakes;
        require(getStakeAmount(current_stakes) >= amount, "Staking: Cannot withdraw more than you have staked");
        for (uint i = 0; i < current_stakes.length; ++i) {
            
            if (current_stakes[i].claimedTime > 0)
            {
                continue;
            }
            
            if (current_stakes[i].amount > amount) {
                current_stakes[i].amount -= amount;
                current_stakes[i].claimedAmount = amount;
                current_stakes[i].claimedTime = block.timestamp;
                break;
            }

            amount -= current_stakes[i].amount;
            current_stakes[i].claimedAmount = current_stakes[i].amount;
            current_stakes[i].claimedTime = block.timestamp;
            current_stakes[i].amount = 0;
        }
    }
     
    function getStakeSummary() external view returns(Stake[] memory) 
    {
        uint256 user_index = stakes[msg.sender];
        return stakeholders[user_index].stakes;
    }
    
}