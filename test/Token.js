const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { exp } = require("prb-math");

describe("Token contract", function ()
{
  let Token;
  let hardhatToken;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async function () {
    Token = await ethers.getContractFactory("Token");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    hardhatToken = await Token.deploy("Colony", "COL", 0, 1000);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await hardhatToken.getOwner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await hardhatToken.balanceOf(owner.address);
      expect(await hardhatToken.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Ownable", function () {
    it("Should transfer ownership from owner", async function () {
      await hardhatToken.transferOwnership(addr1.address);
      expect(await hardhatToken.getOwner()).to.equal(addr1.address);
    });
    it("Should fail transfer ownership if account is not owner", async function() {
      await expect(hardhatToken.connect(addr1).transferOwnership(addr2.address)).to.be.revertedWith("Ownable: only owner can call this function");
    });
    it("Should renounce ownership", async function () {
      await hardhatToken.renounceOwnership();
      expect(await hardhatToken.getOwner()).to.equal("0x0000000000000000000000000000000000000000");
    });
    it("Should fail renounce ownership", async function() {
      await expect(hardhatToken.connect(addr1).renounceOwnership()).to.be.revertedWith("Ownable: only owner can call this function");
    });
  });

  describe("ERC20", function () {
    it("Should return token params", async function () {
      expect(await hardhatToken.name()).to.equal("Colony");
      expect(await hardhatToken.symbol()).to.equal("COL");
      expect(await hardhatToken.decimals()).to.equal(0);
      expect(await hardhatToken.totalSupply()).to.equal(1000);
    });

    it("Should transfer tokens", async function () {
      await hardhatToken.transfer(addr1.address, 200);
      await hardhatToken.transfer(addr2.address, 150);
      expect(await hardhatToken.balanceOf(owner.address)).to.equal(650);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr2).balanceOf(addr2.address)).to.equal(150);

      await hardhatToken.connect(addr1).transfer(addr3.address, 100);
      await hardhatToken.connect(addr2).transfer(addr3.address, 50);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(100);
      expect(await hardhatToken.connect(addr2).balanceOf(addr2.address)).to.equal(100);
      expect(await hardhatToken.connect(addr3).balanceOf(addr3.address)).to.equal(150);
    });

    it("Should fail transfer tokens", async function () {
      await expect(hardhatToken.transfer("0x0000000000000000000000000000000000000000", 1)).to.be.revertedWith("Token: transfer to zero address");
      await expect(hardhatToken.transfer(addr1.address, 1001)).to.be.revertedWith("Token: cant transfer more than your account holds");
    });

    it("Should approve tokens spending", async function () {
      await hardhatToken.approve(addr1.address, 200);
      await hardhatToken.approve(addr2.address, 150);
      expect(await hardhatToken.connect(addr1).allowance(owner.address, addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr2).allowance(owner.address, addr2.address)).to.equal(150);
    });

    it("Should transferFrom", async function () {
      await hardhatToken.approve(addr1.address, 200);
      await hardhatToken.approve(addr2.address, 150);
      await hardhatToken.connect(addr1).transferFrom(owner.address, addr1.address, 100);
      await hardhatToken.connect(addr2).transferFrom(owner.address, addr2.address, 150);

      expect(await hardhatToken.connect(addr1).balanceOf(owner.address)).to.equal(750);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(100);
      expect(await hardhatToken.connect(addr2).balanceOf(addr2.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).allowance(owner.address, addr1.address)).to.equal(100);
      expect(await hardhatToken.connect(addr2).allowance(owner.address, addr2.address)).to.equal(0);
    });

    it("Should fail transferFrom 1", async function () {
      await hardhatToken.approve(addr1.address, 200);
      await expect(hardhatToken.connect(addr1).transferFrom(owner.address, addr1.address, 201)).to.be.revertedWith("Token: You cannot spend that much on this account");
    });

    it("Should fail transferFrom 2", async function () {
      await hardhatToken.approve(addr1.address, 1);
      await hardhatToken.transfer(addr2.address, 1000);
      await expect(hardhatToken.connect(addr1).transferFrom(owner.address, addr1.address, 1)).to.be.revertedWith("Token: cant transfer more than your account holds");
    });
  });

  describe("Stakeable", function () {
    it("Should stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(300);
      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address);
      const amount = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      expect(amount).to.equal(300);
    });

    it("Should stake several times", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).stake(100);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(100);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(400);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address)
      const amount = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);

      expect(amount).to.equal(400);
    });

    it("Should fail stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await expect(hardhatToken.connect(addr1).stake(501)).to.be.revertedWith("Token: Cannot stake more than you own");
      await expect(hardhatToken.connect(addr1).stake(0)).to.be.revertedWith("Cannot stake nothing");
    });

    it("Should fail stake during claim period", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(500);
      await hardhatToken.connect(addr1).stake(200);

      // 1 year
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(200);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await expect(hardhatToken.connect(addr1).stake(200)).to.be.revertedWith("Staking : Can't stake during claim period");
    });

    it("Should claim", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claim();

      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(300);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(0);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address)
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const claimed = parseInt(Object.getOwnPropertyDescriptor(stake, "claimed_amount").value._hex);

      expect(staked).to.equal(0);
      expect(claimed).to.equal(300);
    });

    it("Should claim and withdraw full stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claimAndWithdraw(300);

      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(300);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(0);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address)
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const claimed = parseInt(Object.getOwnPropertyDescriptor(stake, "claimed_amount").value._hex);

      expect(staked).to.equal(0);
      expect(claimed).to.equal(300);
    });

    it("Should claim and withdraw part of the stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claimAndWithdraw(150);

      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(150);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address)
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const claimed = parseInt(Object.getOwnPropertyDescriptor(stake, "claimed_amount").value._hex);

      expect(staked).to.equal(150);
      expect(claimed).to.equal(150);
    });

    it("Should fail claim and withdraw", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await expect(hardhatToken.connect(addr1).claimAndWithdraw(301)).to.be.revertedWith("Staking: Cannot withdraw more than you have staked");
    });

    it("Should fail withdraw not claimed stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await expect(hardhatToken.connect(addr1).withdraw()).to.be.revertedWith("Staking : Can't withdraw unclaimed stake");
    });

    it("Should fail withdraw claimed but non-redeemable stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claimAndWithdraw(150);

      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(150);

      await ethers.provider.send('evm_increaseTime', [3600]); 
      await ethers.provider.send('evm_mine');

      await expect(hardhatToken.connect(addr1).withdraw()).to.be.revertedWith("Staking : Can't withdraw unclaimed stake");
    });

    it("Should withdraw part stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);

      // 1 year stake
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(150);

      const stakeAfterClaim = await hardhatToken.connect(addr1).getStakeSummary(addr1.address)
      const claimedTime = parseInt(Object.getOwnPropertyDescriptor(stakeAfterClaim, "claimed_time").value._hex);

      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(150);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw();

      // reward 22(ceil(22.5))
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(372);
      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(150);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address)
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const since = parseInt(Object.getOwnPropertyDescriptor(stake, "start_time").value._hex);

      expect(staked).to.equal(150);
      expect(since).to.equal(claimedTime);
    });

    it("Should withdraw part stake from several stakes", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(50);
      await hardhatToken.connect(addr1).stake(100);
      await hardhatToken.connect(addr1).stake(150);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address);
      const amount = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);

      expect(amount).to.equal(300);

      // 1 year stake
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(75);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      const stakeAfterClaim = await hardhatToken.connect(addr1).getStakeSummary(addr1.address);
      const amountAfterClaim = parseInt(Object.getOwnPropertyDescriptor(stakeAfterClaim, "amount").value._hex);
      const claimedAmountAfterClaim = parseInt(Object.getOwnPropertyDescriptor(stakeAfterClaim, "claimed_amount").value._hex);

      expect(amountAfterClaim).to.equal(225);
      expect(claimedAmountAfterClaim).to.equal(75);

      await hardhatToken.connect(addr1).withdraw();

      // reward 11(exact 11.25)
      expect(await hardhatToken.totalSupply()).to.equal(1011);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(286);
      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(225);

      const stakeAfterWithdraw = await hardhatToken.connect(addr1).getStakeSummary(addr1.address);
      const amountAfterWithdraw = parseInt(Object.getOwnPropertyDescriptor(stakeAfterWithdraw, "amount").value._hex);
      const claimedAmountAfterWithdraw = parseInt(Object.getOwnPropertyDescriptor(stakeAfterWithdraw, "claimed_amount").value._hex);

      expect(amountAfterWithdraw).to.equal(225);
      expect(claimedAmountAfterWithdraw).to.equal(0);
    });

    it("Should withdraw part stake and continue staking", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(500);
      await hardhatToken.connect(addr1).stake(500);

      // 1 year
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(250);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw();

      // reward 37(exact 37.5)
      expect(await hardhatToken.totalSupply()).to.equal(1037);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(287);
      expect(await hardhatToken.connect(addr1).claimedAmountOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.equal(250);

      // one more year stake of 250 tokens
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claim();

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw();

      // reward 37(exact 37.5)
      expect(await hardhatToken.totalSupply()).to.equal(1074);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(574);
      await expect(hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.be.revertedWith("Staking : No stakes from this user");
    });

    it("Should calculate 'inter staking' reward and withdraw it", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(500);
      await hardhatToken.connect(addr1).stake(100);

      // 1 year
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).stake(100);

      const stake = await hardhatToken.connect(addr1).getStakeSummary(addr1.address);
      const amount = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const reward = parseInt(Object.getOwnPropertyDescriptor(stake, "accumulated_reward").value._hex);

      expect(amount).to.equal(200);
      expect(reward).to.equal(15000000000000000000); // 15

      // 1 year
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claim();

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw();

      // reward 30
      expect(await hardhatToken.totalSupply()).to.equal(1045);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(545);
      await expect(hardhatToken.connect(addr1).stakedAmountOf(addr1.address)).to.be.revertedWith("Staking : No stakes from this user");
    });
  });
});
