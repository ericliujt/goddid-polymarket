// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { IWeb2Json } from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

struct Position {
    int256 realizedPnl;
    int256 totalBought;
    string asset;
}

struct CurrentPosition {
    int256 size;
    int256 avgPrice;
    int256 initialValue;
    int256 currentValue;
    int256 cashPnl;
    int256 percentPnl;
    int256 totalBought;
    int256 realizedPnl;
    int256 percentRealizedPnl;
    int256 curPrice;
}

struct PolymarketUserData {
    string name;
    int256 value;
    Position[] closedPositions;
    CurrentPosition[] currentPositions;
}

struct ClosedPositionsDTO {
    Position[] positions;
}

struct CurrentPositionsDTO {
    CurrentPosition[] positions;
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
        IWeb2Json.Proof calldata activityProof,
        IWeb2Json.Proof calldata currentPositionsProof
    ) external;
    function getUserData() external view returns (PolymarketUserData memory);
}

contract PolymarketUserDataStore {
    PolymarketUserData public userData;
    bool public dataStored;

    function addUserData(
        IWeb2Json.Proof calldata closedPositionsProof,
        IWeb2Json.Proof calldata valueProof,
        IWeb2Json.Proof calldata activityProof,
        IWeb2Json.Proof calldata currentPositionsProof
    ) public {
        require(isWeb2JsonProofValid(closedPositionsProof), "Invalid closed positions proof");
        require(isWeb2JsonProofValid(valueProof), "Invalid value proof");
        require(isWeb2JsonProofValid(activityProof), "Invalid activity proof");
        require(isWeb2JsonProofValid(currentPositionsProof), "Invalid current positions proof");

        ClosedPositionsDTO memory closedPositions = abi.decode(
            closedPositionsProof.data.responseBody.abiEncodedData,
            (ClosedPositionsDTO)
        );
        ValueDTO memory valueData = abi.decode(valueProof.data.responseBody.abiEncodedData, (ValueDTO));
        ActivityDTO memory activityData = abi.decode(activityProof.data.responseBody.abiEncodedData, (ActivityDTO));
        CurrentPositionsDTO memory currentPositions = abi.decode(
            currentPositionsProof.data.responseBody.abiEncodedData,
            (CurrentPositionsDTO)
        );

        require(!dataStored, "Data already stored");

        // Initialize userData with name and value
        userData.name = activityData.name;
        userData.value = valueData.value;

        // Copy closed positions array
        for (uint256 i = 0; i < closedPositions.positions.length; i++) {
            userData.closedPositions.push(closedPositions.positions[i]);
        }

        // Copy current positions array
        for (uint256 i = 0; i < currentPositions.positions.length; i++) {
            userData.currentPositions.push(currentPositions.positions[i]);
        }

        dataStored = true;
    }

    function getUserData() public view returns (PolymarketUserData memory) {
        require(dataStored, "No data stored yet");
        return userData;
    }

    function abiSignatureHackClosedPositions(ClosedPositionsDTO calldata dto) public pure {}
    function abiSignatureHackPosition(Position calldata position) public pure {}
    function abiSignatureHackCurrentPositions(CurrentPositionsDTO calldata dto) public pure {}
    function abiSignatureHackCurrentPosition(CurrentPosition calldata position) public pure {}

    function getClosedPositionCount() public view returns (uint256) {
        require(dataStored, "No data stored yet");
        return userData.closedPositions.length;
    }

    function getClosedPosition(uint256 index) public view returns (Position memory) {
        require(dataStored, "No data stored yet");
        require(index < userData.closedPositions.length, "Index out of bounds");
        return userData.closedPositions[index];
    }

    function getCurrentPositionCount() public view returns (uint256) {
        require(dataStored, "No data stored yet");
        return userData.currentPositions.length;
    }

    function getCurrentPosition(uint256 index) public view returns (CurrentPosition memory) {
        require(dataStored, "No data stored yet");
        require(index < userData.currentPositions.length, "Index out of bounds");
        return userData.currentPositions[index];
    }
    function abiSignatureHackValue(ValueDTO calldata dto) public pure {}
    function abiSignatureHackActivity(ActivityDTO calldata dto) public pure {}

    function isWeb2JsonProofValid(IWeb2Json.Proof calldata _proof) private view returns (bool) {
        return ContractRegistry.getFdcVerification().verifyWeb2Json(_proof);
    }
}
