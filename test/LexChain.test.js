const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LexChain roles", function () {
  async function deployLexChainFixture() {
    const [deployer, user] = await ethers.getSigners();
    const LexChain = await ethers.getContractFactory("LexChain");
    const lexChain = await LexChain.deploy();
    await lexChain.deployed();

    return { lexChain, deployer, user };
  }

  it("grants DEFAULT_ADMIN_ROLE to deployer in constructor", async function () {
    const { lexChain, deployer } = await deployLexChainFixture();
    const defaultAdminRole = await lexChain.DEFAULT_ADMIN_ROLE();

    expect(await lexChain.hasRole(defaultAdminRole, deployer.address)).to.equal(true);
  });

  it("allows admin to grant POLICE_ROLE", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const policeRole = await lexChain.POLICE_ROLE();

    await lexChain.grantPoliceRole(user.address);

    expect(await lexChain.hasRole(policeRole, user.address)).to.equal(true);
  });

  it("allows admin to grant JUDGE_ROLE", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const judgeRole = await lexChain.JUDGE_ROLE();

    await lexChain.grantJudgeRole(user.address);

    expect(await lexChain.hasRole(judgeRole, user.address)).to.equal(true);
  });

  it("reverts when non-admin tries to grant POLICE_ROLE", async function () {
    const { lexChain, deployer, user } = await deployLexChainFixture();
    const defaultAdminRole = await lexChain.DEFAULT_ADMIN_ROLE();

    await expect(
      lexChain.connect(user).grantPoliceRole(deployer.address)
    )
      .to.be.revertedWithCustomError(lexChain, "AccessControlUnauthorizedAccount")
      .withArgs(user.address, defaultAdminRole);
  });

  it("reverts when non-admin tries to grant JUDGE_ROLE", async function () {
    const { lexChain, deployer, user } = await deployLexChainFixture();
    const defaultAdminRole = await lexChain.DEFAULT_ADMIN_ROLE();

    await expect(
      lexChain.connect(user).grantJudgeRole(deployer.address)
    )
      .to.be.revertedWithCustomError(lexChain, "AccessControlUnauthorizedAccount")
      .withArgs(user.address, defaultAdminRole);
  });

  it("allows a user with POLICE_ROLE to add evidence", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const ipfsCID = "cid-police-1";
    const fileHash = "hash-police-1";
    const caseNumber = "CASE-001";

    await lexChain.grantPoliceRole(user.address);

    await expect(
      lexChain.connect(user).addEvidence(ipfsCID, fileHash, caseNumber)
    ).to.emit(lexChain, "EvidenceAdded");
  });

  it("reverts when user without POLICE_ROLE tries to add evidence", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const policeRole = await lexChain.POLICE_ROLE();

    await expect(
      lexChain.connect(user).addEvidence("cid-no-role", "hash-no-role", "CASE-002")
    )
      .to.be.revertedWithCustomError(lexChain, "AccessControlUnauthorizedAccount")
      .withArgs(user.address, policeRole);
  });

  it("stores and retrieves evidence details correctly", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const ipfsCID = "cid-store-1";
    const fileHash = "hash-store-1";
    const caseNumber = "CASE-003";

    await lexChain.grantPoliceRole(user.address);
    await lexChain.connect(user).addEvidence(ipfsCID, fileHash, caseNumber);

    const evidence = await lexChain.getEvidence(ipfsCID);

    expect(evidence.ipfsCID).to.equal(ipfsCID);
    expect(evidence.fileHash).to.equal(fileHash);
    expect(evidence.caseNumber).to.equal(caseNumber);
    expect(evidence.addedBy).to.equal(user.address);
    expect(evidence.timestamp).to.be.gt(0);
  });

  it("prevents overwriting evidence with the same ipfsCID", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const ipfsCID = "cid-immutable-1";

    await lexChain.grantPoliceRole(user.address);
    await lexChain.connect(user).addEvidence(ipfsCID, "hash-1", "CASE-IMM-1");

    await expect(
      lexChain.connect(user).addEvidence(ipfsCID, "hash-2", "CASE-IMM-2")
    ).to.be.revertedWith("Evidence already exists");
  });

  it("restricts getEvidence to JUDGE_ROLE or DEFAULT_ADMIN_ROLE", async function () {
    const { lexChain, user } = await deployLexChainFixture();
    const ipfsCID = "cid-restrict-1";

    await lexChain.grantPoliceRole(user.address);
    await lexChain.connect(user).addEvidence(ipfsCID, "hash-restrict-1", "CASE-RESTRICT-1");

    await expect(lexChain.connect(user).getEvidence(ipfsCID))
      .to.be.revertedWithCustomError(lexChain, "NotAuthorized");

    await lexChain.grantJudgeRole(user.address);
    const evidence = await lexChain.connect(user).getEvidence(ipfsCID);
    expect(evidence.ipfsCID).to.equal(ipfsCID);
  });
});
