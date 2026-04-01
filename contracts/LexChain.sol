// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract LexChain is AccessControl {
    bytes32 public constant POLICE_ROLE = keccak256("POLICE_ROLE");
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");

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

    function addEvidence(
        string memory _ipfsCID,
        string memory _fileHash,
        string memory _caseNumber
    ) public onlyRole(POLICE_ROLE) {
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
        return evidences[_ipfsCID];
    }
}