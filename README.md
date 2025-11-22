# Flare Hardhat Starter Kit

This is a starter kit for interacting with Flare blockchain.
It provides example code for interacting with enshrined Flare protocol, and useful deployed contracts.
It also demonstrates, how the official Flare smart contract periphery [package](https://www.npmjs.com/package/@flarenetwork/flare-periphery-contracts) can be used in your projects.

## Getting started

If you are new to Hardhat please check the [Hardhat getting started doc](https://hardhat.org/hardhat-runner/docs/getting-started#overview)

1. Clone and install dependencies:

    ```console
    git clone https://github.com/flare-foundation/flare-hardhat-starter.git
    cd flare-hardhat-starter
    ```

    and then run:

    ```console
    yarn
    ```

    or

    ```console
    npm install --force
    ```

2. Set up `.env` file

    ```console
    cp .env.example .env
    ```

3. Change the `PRIVATE_KEY` in the `.env` file to yours

4. Compile the project

    ```console
    yarn hardhat compile
    ```

    or

    ```console
    npx hardhat compile
    ```

    This will compile all `.sol` files in your `/contracts` folder.
    It will also generate artifacts and TypeScript type definitions needed for scripts.

5. Run Scripts

    **Polymarket Scripts:**
    
    ```console
    # Fetch and store Polymarket user data
    npx hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2
    
    # Fetch and store Polymarket positions
    npx hardhat run scripts/polymarket/PolymarketPosition.ts --network coston2
    ```

    **FAssets Scripts:**
    
    ```console
    # Get FXRP contract address
    npx hardhat run scripts/fassets/getFXRP.ts --network coston2
    
    # Get FAssets settings
    npx hardhat run scripts/fassets/settings.ts --network coston2
    ```

    For more details, see [scripts/README.md](./scripts/README.md)

6. Run Tests (if available)

    ```console
    yarn hardhat test
    ```

    or

    ```console
    npx hardhat test
    ```

## Repository structure

```
├── contracts: Solidity smart contracts
├── scripts: Typescript scripts that interact with the blockchain
├── test
├── hardhat.config.ts
├── package.json
├── README.md
├── tsconfig.json
└── yarn.lock
```

## Contributing

Before opening a pull request, lint and format the code.
You can do that by running the following commands.

```sh
yarn format:fix
```

```sh
yarn lint:fix
```

## Quick Reference

**Compile contracts:**
```bash
npx hardhat compile
```

**Run Polymarket script:**
```bash
npx hardhat run scripts/polymarket/PolymarketUserData.ts --network coston2
```

**Run FAssets script:**
```bash
npx hardhat run scripts/fassets/getFXRP.ts --network coston2
```

For detailed startup instructions, see [scripts/README.md](./scripts/README.md)

## Resources

- [Flare Developer Hub](https://dev.flare.network/)
- [Hardhat Guides](https://dev.flare.network/fdc/guides/hardhat)
- [Hardhat Docs](https://hardhat.org/docs)
