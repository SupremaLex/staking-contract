pragma solidity 0.8.4;

import "prb-math/contracts/PRBMathUD60x18.sol";

contract Stakeable
{
    using PRBMathUD60x18 for uint256;

    struct Stake
    {
        uint256 amount;
        uint256 since;
        uint256 claimed_amount;
        uint256 claimed_time;
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
    // lets assume that year has 365 days
    uint256 internal YEAR = 365 * 24;
    
    constructor()
    {
        stakeholders.push();
    }
    
    function _addStakeholder(address staker) internal returns (uint256)
    {
        stakeholders.push();
        uint256 user_index = stakeholders.length - 1;
        stakeholders[user_index].user = staker;
        stakes[staker] = user_index;
        return user_index; 
    }

    function _removeStakeholder(address staker) internal
    {
        uint256 user_index = stakes[staker];
        if (user_index != 0)
        {
            stakeholders[user_index] = stakeholders[stakeholders.length - 1];
            stakeholders.pop();
        }
    }
    
    function _stake(uint256 amount) internal
    {
        require(amount > 0, "Cannot stake nothing");
        
        uint256 index = stakes[msg.sender];
        uint256 timestamp = block.timestamp;
        if(index == 0)
        {
            index = _addStakeholder(msg.sender);
        }

        stakeholders[index].stakes.push(Stake(amount, timestamp, 0, 0));
        emit Staked(msg.sender, amount, index, timestamp);
    }
    
    function calculateStakeReward(Stake memory current_stake) internal view returns (uint256)
    {
        uint256 stake_duration_hours = PRBMathUD60x18.floor(PRBMathUD60x18.div(current_stake.claimed_time - current_stake.since, 1 hours));
        return PRBMathUD60x18.mul(PRBMathUD60x18.mul(PRBMathUD60x18.div(stake_duration_hours, YEAR), PRBMathUD60x18.div(APY, 1000)), current_stake.claimed_amount);
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
                        user_stakes[i] = user_stakes[user_stakes.length - shift];
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
            if (current_stakes[i].claimed_time == 0 || block.timestamp - current_stakes[i].claimed_time < 1 days)
            {
                continue;
            }
            
            reward += calculateStakeReward(current_stakes[i]);
            withdrawed += current_stakes[i].claimed_amount;
            current_stakes[i].claimed_amount = 0;
            
            if (current_stakes[i].amount > 0)
            {
                current_stakes[i].since = current_stakes[i].claimed_time;
                current_stakes[i].claimed_time = 0;
            }
        }
        
        // cleaning storage data
        removeZeroStakes(stakeholders[user_index].stakes);
        bool hasStakes = false;
        for (uint i = 0; i < stakeholders[user_index].stakes.length; ++i)
        {
            if (stakeholders[user_index].stakes[i].amount > 0 || stakeholders[user_index].stakes[i].claimed_amount > 0)
            {
                hasStakes = true;
                break;
            }
        }
        if (!hasStakes)
        {
            _removeStakeholder(msg.sender);
        }

        emit Withdrawed(withdrawed, reward, block.timestamp);
        return (withdrawed, reward);
     }
    
    function _claim() internal
    {
        uint256 user_index = stakes[msg.sender];
        Stake[] storage current_stakes = stakeholders[user_index].stakes;
        for (uint i = 0; i < current_stakes.length; ++i) {
            if (current_stakes[i].claimed_time > 0)
            {
                continue;
            }
            current_stakes[i].claimed_time = block.timestamp;
            current_stakes[i].claimed_amount = current_stakes[i].amount;
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
            
            if (current_stakes[i].claimed_time > 0)
            {
                continue;
            }
            
            if (current_stakes[i].amount > amount) {
                current_stakes[i].amount -= amount;
                current_stakes[i].claimed_amount = amount;
                current_stakes[i].claimed_time = block.timestamp;
                break;
            }

            amount -= current_stakes[i].amount;
            current_stakes[i].claimed_amount = current_stakes[i].amount;
            current_stakes[i].claimed_time = block.timestamp;
            current_stakes[i].amount = 0;
        }
    }
     
    function getStakeSummary() external view returns(Stake[] memory) 
    {
        uint256 user_index = stakes[msg.sender];
        return stakeholders[user_index].stakes;
    }
    
}