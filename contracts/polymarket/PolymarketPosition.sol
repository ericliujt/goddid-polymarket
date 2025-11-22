// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { IWeb2Json } from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

struct PolymarketPosition {
    string asset;
    string conditionId;
    int256 percentRealizedPnl;
}

struct DataTransportObject {
    string asset;
    string conditionId;
    int256 percentRealizedPnl;
}

interface IPolymarketPositionList {
    function addPosition(IWeb2Json.Proof calldata data) external;
    function getAllPositions() external view returns (PolymarketPosition[] memory);
    function getPositionByAsset(string calldata asset) external view returns (PolymarketPosition memory);
}

contract PolymarketPositionList {
    mapping(string => PolymarketPosition) public positions;
    string[] public assetIds;

    function addPosition(IWeb2Json.Proof calldata data) public {
        require(isWeb2JsonProofValid(data), "Invalid proof");

        DataTransportObject memory dto = abi.decode(data.data.responseBody.abiEncodedData, (DataTransportObject));

        // Check if position already exists (using asset as unique identifier)
        require(bytes(positions[dto.asset].asset).length == 0, "Position already exists");

        PolymarketPosition memory position = PolymarketPosition({
            asset: dto.asset,
            conditionId: dto.conditionId,
            percentRealizedPnl: dto.percentRealizedPnl
        });

        positions[dto.asset] = position;
        assetIds.push(dto.asset);
    }

    function getAllPositions() public view returns (PolymarketPosition[] memory) {
        PolymarketPosition[] memory result = new PolymarketPosition[](assetIds.length);
        for (uint256 i = 0; i < assetIds.length; i++) {
            result[i] = positions[assetIds[i]];
        }
        return result;
    }

    function getPositionByAsset(string calldata asset) public view returns (PolymarketPosition memory) {
        return positions[asset];
    }

    function abiSignatureHack(DataTransportObject calldata dto) public pure {}

    function isWeb2JsonProofValid(IWeb2Json.Proof calldata _proof) private view returns (bool) {
        // Inline the check for now until we have an official contract deployed
        return ContractRegistry.getFdcVerification().verifyWeb2Json(_proof);
    }
}

