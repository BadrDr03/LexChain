// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract LexChain is AccessControl {
    bytes32 public constant POLICE_ROLE = keccak256("POLICE_ROLE");
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");

    error NotAuthorized();

    struct Evidence {
        string ipfsCID;
        string fileHash;
        string caseNumber;
        address addedBy;
        uint256 timestamp;
    }

    mapping(string => Evidence) private evidences;
    event EvidenceAdded(string ipfsCID, string caseNumber, address addedBy);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function grantPoliceRole(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(POLICE_ROLE, account);
    }

    function grantJudgeRole(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(JUDGE_ROLE, account);
    }

    function addEvidence(
        string memory _ipfsCID,
        string memory _fileHash,
        string memory _caseNumber
    ) public onlyRole(POLICE_ROLE) {
        require(bytes(evidences[_ipfsCID].ipfsCID).length == 0, "Evidence already exists");
        evidences[_ipfsCID] = Evidence({
            ipfsCID: _ipfsCID,
            fileHash: _fileHash,
            caseNumber: _caseNumber,
            addedBy: msg.sender,
            timestamp: block.timestamp
        });
        emit EvidenceAdded(_ipfsCID, _caseNumber, msg.sender);
    }

    function getEvidence(string memory _ipfsCID) public view returns (Evidence memory) {
        if (!_isJudgeOrAdmin(msg.sender)) revert NotAuthorized();
        return evidences[_ipfsCID];
    }

    function _isJudgeOrAdmin(address account) internal view returns (bool) {
        return hasRole(JUDGE_ROLE, account) || hasRole(DEFAULT_ADMIN_ROLE, account);
    }
}