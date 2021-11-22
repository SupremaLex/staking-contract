pragma solidity 0.8.4;

import "prb-math/contracts/PRBMathUD60x18.sol";

contract Stakeable
{
    using PRBMathUD60x18 for uint256;

    struct Stake
    {
        uint256 amount;
        uint256 start_time;
        uint256 claimed_amount;
        uint256 claimed_time;
        uint256 accumulated_reward;
    }
    
    struct Stakeholder
    {
        address user;
        Stake stake;
    }
    
    Stakeholder[] internal stakeholders;
    mapping(address => uint256) internal stakes;
    event Staked(address indexed user, uint256 amount, uint256 index, uint256 timestamp);
    event Claimed(uint256 amount, uint256 timestamp);
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
        require(amount > 0, "Staking : Cannot stake nothing");
        
        uint256 index = stakes[msg.sender];
        uint256 timestamp = block.timestamp;
        if(index == 0)
        {
            index = _addStakeholder(msg.sender);
        }
        require(stakeholders[index].stake.claimed_time == 0, "Staking : Can't stake during claim period");
        stakeholders[index].stake.accumulated_reward = calculateStakeReward(timestamp, stakeholders[index].stake.start_time, stakeholders[index].stake.amount);
        stakeholders[index].stake.amount += amount;
        stakeholders[index].stake.start_time = timestamp;
        emit Staked(msg.sender, amount, index, timestamp);
    }
    
    function calculateStakeReward(uint256 end_time, uint256 start_time, uint256 amount) internal view returns (uint256)
    {
        uint256 stake_duration_hours = PRBMathUD60x18.floor(PRBMathUD60x18.div(end_time - start_time, 1 hours));
        return PRBMathUD60x18.mul(PRBMathUD60x18.mul(PRBMathUD60x18.div(stake_duration_hours, YEAR), PRBMathUD60x18.div(APY, 1000)), amount);
    }
    
    function _withdraw() internal returns (uint256, uint256)
    {
        uint256 user_index = stakes[msg.sender];
        Stake storage stake = stakeholders[user_index].stake;

        if (stake.claimed_time == 0 || block.timestamp - stake.claimed_time < 1 days)
        {
            return (0, 0);
        }

        uint256 reward = calculateStakeReward(stake.claimed_time, stake.start_time, stake.claimed_amount) + stake.accumulated_reward;
        stake.accumulated_reward = 0;
        uint256 withdrawed = stake.claimed_amount;
        stake.claimed_amount = 0;
            
        if (stake.amount > 0)
        {
            stake.start_time = stake.claimed_time;
            stake.claimed_time = 0;
        }
        
        if (stakeholders[user_index].stake.amount == 0 && stakeholders[user_index].stake.claimed_amount == 0)
        {
            _removeStakeholder(msg.sender);
        }

        emit Withdrawed(withdrawed, reward, block.timestamp);
        return (withdrawed, reward);
     }
    
    function _claim() internal
    {
        uint256 user_index = stakes[msg.sender];
        Stake storage current_stake = stakeholders[user_index].stake;
        if (current_stake.claimed_time == 0)
        {
            current_stake.claimed_time = block.timestamp;
            current_stake.claimed_amount = current_stake.amount;
            current_stake.amount = 0;
        }

        emit Claimed(current_stake.claimed_amount, block.timestamp);
    }
    
    function _claimAndWithdraw(uint256 amount) internal
    {
        uint256 user_index = stakes[msg.sender];
        Stake storage current_stake = stakeholders[user_index].stake;
        require(current_stake.amount >= amount, "Staking: Cannot withdraw more than you have staked");
        
        if (current_stake.claimed_time == 0)
        {
            current_stake.claimed_time = block.timestamp;
            current_stake.amount -= amount;
            current_stake.claimed_amount += amount;

        }
        emit Claimed(amount, block.timestamp);
    }
     
    function getStakeSummary() external view returns(Stake memory) 
    {
        uint256 user_index = stakes[msg.sender];
        return stakeholders[user_index].stake;
    }
    
}