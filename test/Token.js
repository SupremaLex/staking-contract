const { expect } = require("chai");
const { ethers } = require("hardhat");

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
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(300);
      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const amount = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      expect(amount).to.equal(300);
    });

    it("Should stake several times", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).stake(100);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(100);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(400);

      const stake1 = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const stake2 = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 1).value;
      const amount1 = parseInt(Object.getOwnPropertyDescriptor(stake1, "amount").value._hex);
      const amount2 = parseInt(Object.getOwnPropertyDescriptor(stake2, "amount").value._hex);

      expect(amount1).to.equal(300);
      expect(amount2).to.equal(100);
    });

    it("Should fail stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await expect(hardhatToken.connect(addr1).stake(501)).to.be.revertedWith("Token: Cannot stake more than you own");
      await expect(hardhatToken.connect(addr1).stake(0)).to.be.revertedWith("Cannot stake nothing");
    });

    it("Should claim", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claim();

      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(300);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(0);

      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const claimed = parseInt(Object.getOwnPropertyDescriptor(stake, "claimed_amount").value._hex);

      expect(staked).to.equal(0);
      expect(claimed).to.equal(300);
    });

    it("Should claim and withdraw full stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claimAndWithdraw(300);

      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(300);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(0);

      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const claimed = parseInt(Object.getOwnPropertyDescriptor(stake, "claimed_amount").value._hex);

      expect(staked).to.equal(0);
      expect(claimed).to.equal(300);
    });

    it("Should claim and withdraw part of the stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claimAndWithdraw(150);

      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(150);

      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
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

    it("Should try withdraw not claimed stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).withdraw();

      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(300);

      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const claimed = parseInt(Object.getOwnPropertyDescriptor(stake, "claimed_amount").value._hex);

      expect(staked).to.equal(300);
      expect(claimed).to.equal(0);
    });

    it("Should try withdraw claimed but non-redeemable stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);
      await hardhatToken.connect(addr1).claimAndWithdraw(150);

      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(150);

      await ethers.provider.send('evm_increaseTime', [3600]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw();

      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(150);

      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);

      expect(staked).to.equal(150);
    });

    it("Should withdraw part stake", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(300);

      // 1 year stake
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(150);

      const stakeAfterClaim = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const claimedTime = parseInt(Object.getOwnPropertyDescriptor(stakeAfterClaim, "claimed_time").value._hex);

      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(200);
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(150);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(150);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw();

      // reward 22(ceil(22.5))
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(372);
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(150);

      const stake = Object.getOwnPropertyDescriptor(await hardhatToken.connect(addr1).getStakeSummary(), 0).value;
      const staked = parseInt(Object.getOwnPropertyDescriptor(stake, "amount").value._hex);
      const since = parseInt(Object.getOwnPropertyDescriptor(stake, "since").value._hex);

      expect(staked).to.equal(150);
      expect(since).to.equal(claimedTime);
    });

    it("Should withdraw part stake from several stakes", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(50);
      await hardhatToken.connect(addr1).stake(100);
      await hardhatToken.connect(addr1).stake(150);

      const stakes = await hardhatToken.connect(addr1).getStakeSummary();
      const stake1 = Object.getOwnPropertyDescriptor(stakes, 0).value;
      const stake2 = Object.getOwnPropertyDescriptor(stakes, 1).value;
      const stake3 = Object.getOwnPropertyDescriptor(stakes, 2).value;
      const amount1 = parseInt(Object.getOwnPropertyDescriptor(stake1, "amount").value._hex);
      const amount2 = parseInt(Object.getOwnPropertyDescriptor(stake2, "amount").value._hex);
      const amount3 = parseInt(Object.getOwnPropertyDescriptor(stake3, "amount").value._hex);

      expect(amount1).to.equal(50);
      expect(amount2).to.equal(100);
      expect(amount3).to.equal(150);

      // 1 year stake
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(75);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      const stakesAfterClaim = await hardhatToken.connect(addr1).getStakeSummary();
      const stake1AfterClaim = Object.getOwnPropertyDescriptor(stakesAfterClaim, 0).value;
      const stake2AfterClaim = Object.getOwnPropertyDescriptor(stakesAfterClaim, 1).value;
      const stake3AfterClaim = Object.getOwnPropertyDescriptor(stakesAfterClaim, 2).value;
      const amount1AfterClaim = parseInt(Object.getOwnPropertyDescriptor(stake1AfterClaim, "amount").value._hex);
      const amount2AfterClaim = parseInt(Object.getOwnPropertyDescriptor(stake2AfterClaim, "amount").value._hex);
      const amount3AfterClaim = parseInt(Object.getOwnPropertyDescriptor(stake3AfterClaim, "amount").value._hex);
      const claimedAmount1AfterClaim = parseInt(Object.getOwnPropertyDescriptor(stake1AfterClaim, "claimed_amount").value._hex);
      const claimedAmount2AfterClaim = parseInt(Object.getOwnPropertyDescriptor(stake2AfterClaim, "claimed_amount").value._hex);
      const claimedAmount3AfterClaim = parseInt(Object.getOwnPropertyDescriptor(stake3AfterClaim, "claimed_amount").value._hex);

      expect(amount1AfterClaim).to.equal(0);
      expect(amount2AfterClaim).to.equal(75);
      expect(amount3AfterClaim).to.equal(150);
      expect(claimedAmount1AfterClaim).to.equal(50);
      expect(claimedAmount2AfterClaim).to.equal(25);
      expect(claimedAmount3AfterClaim).to.equal(0);

      await hardhatToken.connect(addr1).withdraw();

      // reward 11(exact 11.25)
      expect(await hardhatToken.totalSupply()).to.equal(1011);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(286);
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(225);

      const stakesAfterWithdraw = await hardhatToken.connect(addr1).getStakeSummary();
      const stake1AfterWithdraw = Object.getOwnPropertyDescriptor(stakesAfterWithdraw, 0).value;
      const stake2AfterWithdraw = Object.getOwnPropertyDescriptor(stakesAfterWithdraw, 1).value;
      const amount1AfterWithdraw = parseInt(Object.getOwnPropertyDescriptor(stake1AfterWithdraw, "amount").value._hex);
      const amount2AfterWithdraw = parseInt(Object.getOwnPropertyDescriptor(stake2AfterWithdraw, "amount").value._hex);
      const claimedAmount1AfterWithdraw = parseInt(Object.getOwnPropertyDescriptor(stake1AfterWithdraw, "claimed_amount").value._hex);
      const claimedAmount2AfterWithdraw = parseInt(Object.getOwnPropertyDescriptor(stake2AfterWithdraw, "claimed_amount").value._hex);

      // Order of stakes is not preserved after withdraw
      expect(amount1AfterWithdraw).to.equal(150);
      expect(amount2AfterWithdraw).to.equal(75);
      expect(claimedAmount1AfterWithdraw).to.equal(0);
      expect(claimedAmount2AfterWithdraw).to.equal(0);
    });

    it("Should remove zero stakes after withdraw", async function () {
      await hardhatToken.transfer(addr1.address, 500);
      await hardhatToken.connect(addr1).stake(50);
      await hardhatToken.connect(addr1).stake(100);
      await hardhatToken.connect(addr1).stake(150);
      await hardhatToken.connect(addr1).stake(150);

      // 1 year
      await ethers.provider.send('evm_increaseTime', [31536000]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).claimAndWithdraw(300);

      await ethers.provider.send('evm_increaseTime', [86400]); 
      await ethers.provider.send('evm_mine');

      await hardhatToken.connect(addr1).withdraw(); // first three stakes should be removed from array

      // reward 45
      expect(await hardhatToken.totalSupply()).to.equal(1045);
      expect(await hardhatToken.connect(addr1).balanceOf(addr1.address)).to.equal(395);
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(150);

      const stakesAfterWithdraw = await hardhatToken.connect(addr1).getStakeSummary();
      expect(Object.keys(stakesAfterWithdraw).length).to.equal(1);
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
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(250);

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
      expect(await hardhatToken.connect(addr1).claimedBalanceOf(addr1.address)).to.equal(0);
      expect(await hardhatToken.connect(addr1).lockedBalanceOf(addr1.address)).to.equal(0);
    });
  });
});
