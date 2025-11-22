// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { IWeb2Json } from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

struct Position {
    int256 realizedPnl;
    int256 totalBought;
    string asset;
}

struct PolymarketUserData {
    string name;
    int256 value;
    Position[] positions;
}

struct ClosedPositionsDTO {
    Position[] positions;
}

struct ValueDTO {
    int256 value;
}

struct ActivityDTO {
    string name;
}

interface IPolymarketUserDataStore {
    function addUserData(
        IWeb2Json.Proof calldata closedPositionsProof,
        IWeb2Json.Proof calldata valueProof,
        IWeb2Json.Proof calldata activityProof
    ) external;
    function getUserData() external view returns (PolymarketUserData memory);
}

contract PolymarketUserDataStore {
    PolymarketUserData public userData;
    bool public dataStored;

    function addUserData(
        IWeb2Json.Proof calldata closedPositionsProof,
        IWeb2Json.Proof calldata valueProof,
        IWeb2Json.Proof calldata activityProof
    ) public {
        require(isWeb2JsonProofValid(closedPositionsProof), "Invalid closed positions proof");
        require(isWeb2JsonProofValid(valueProof), "Invalid value proof");
        require(isWeb2JsonProofValid(activityProof), "Invalid activity proof");

        ClosedPositionsDTO memory closedPositions = abi.decode(
            closedPositionsProof.data.responseBody.abiEncodedData,
            (ClosedPositionsDTO)
        );
        ValueDTO memory valueData = abi.decode(valueProof.data.responseBody.abiEncodedData, (ValueDTO));
        ActivityDTO memory activityData = abi.decode(
            activityProof.data.responseBody.abiEncodedData,
            (ActivityDTO)
        );

        require(!dataStored, "Data already stored");
        require(closedPositions.positions.length > 0, "No positions found");

        // Initialize userData with name and value
        userData.name = activityData.name;
        userData.value = valueData.value;
        
        // Copy positions array (Solidity doesn't support direct assignment of dynamic arrays)
        for (uint256 i = 0; i < closedPositions.positions.length; i++) {
            userData.positions.push(closedPositions.positions[i]);
        }

        dataStored = true;
    }

    function getUserData() public view returns (PolymarketUserData memory) {
        require(dataStored, "No data stored yet");
        return userData;
    }

    function abiSignatureHackClosedPositions(ClosedPositionsDTO calldata dto) public pure {}
    function abiSignatureHackPosition(Position calldata position) public pure {}
    
    function getPositionCount() public view returns (uint256) {
        require(dataStored, "No data stored yet");
        return userData.positions.length;
    }
    
    function getPosition(uint256 index) public view returns (Position memory) {
        require(dataStored, "No data stored yet");
        require(index < userData.positions.length, "Index out of bounds");
        return userData.positions[index];
    }
    function abiSignatureHackValue(ValueDTO calldata dto) public pure {}
    function abiSignatureHackActivity(ActivityDTO calldata dto) public pure {}

    function isWeb2JsonProofValid(IWeb2Json.Proof calldata _proof) private view returns (bool) {
        return ContractRegistry.getFdcVerification().verifyWeb2Json(_proof);
    }
}

