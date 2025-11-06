# Cross-Chain Lending Protocol Submission

## Project Overview

A decentralized cross-chain lending protocol enabling users to request loans on Ethereum Sepolia with ETH collateral and receive/repay loans in MATIC on KOPLI, utilizing Reactive Network for secure cross-chain communication.

## Cross-Chain Lending dApp Flow

### 1. User Onboarding

1. User visits the dApp website
2. Connects their wallet (e.g., MetaMask) to the dApp
3. The dApp detects the connected network (Ethereum Sepolia or KOPLI)

### 2. Borrowing Process

#### A. Collateral Deposit (on Ethereum Sepolia)

1. User navigates to the "Borrow" tab
2. Enters the amount of ETH they want to use as collateral
3. The dApp calculates and displays:
   - Collateral value in USD (using Chainlink ETH/USD price feed)
   - Maximum loan amount in MATIC
   - Estimated interest rate
   - Loan-to-Value (LTV) ratio
   - Liquidation threshold
4. User selects loan duration and confirms the transaction
5. The `OriginContract` on Ethereum Sepolia is called:
   - `depositCollateral()` function is executed
   - Collateral is locked in the contract
   - Loan details are stored in the contract
   - `CollateralDeposited` and `LoanInitiated` events are emitted

#### B. Loan Issuance (on KOPLI)

1. The Reactive Contract (off-chain) listens for the `LoanInitiated` event
2. It triggers a cross-chain message to the KOPLI network
3. The `DestinationContract` on KOPLI receives the message and:
   - Calls the `issueLoan()` function
   - Transfers MATIC to the user's wallet
   - Emits a `LoanIssued` event
4. The dApp frontend updates to show the loan has been issued

### 3. Loan Management

#### A. Monitoring

1. The dApp regularly updates the loan status, including:
   - Current collateral value
   - Amount owed (principal + interest)
   - Time until due date
   - Current LTV ratio
2. If the LTV ratio approaches the liquidation threshold, the dApp alerts the user

#### B. Repayment (on KOPLI)

1. User navigates to the "Repay" tab
2. Selects the loan they want to repay
3. Enters the repayment amount in MATIC
4. Confirms the transaction
5. The `DestinationContract` on KOPLI:
   - Calls the `repayLoan()` function
   - Updates the loan status
   - Emits a `LoanRepaid` event
6. If the loan is fully repaid:
   - Emits a `LoanFullyRepaid` event
   - The Reactive Contract sends a cross-chain message to Ethereum Sepolia

#### C. Collateral Release (on Ethereum Sepolia)

1. The `OriginContract` receives the cross-chain message about full repayment
2. It calls the `releaseCollateral()` function:
   - Transfers the locked ETH back to the user
   - Emits a `CollateralReleased` event
3. The dApp frontend updates to show the collateral has been released

### 4. Liquidation Process

#### A. Liquidation Trigger

1. The dApp or an off-chain bot monitors the LTV ratios of all loans
2. If a loan's LTV ratio exceeds the liquidation threshold:
   - The bot or a liquidator calls the `liquidateLoan()` function on the `DestinationContract`

#### B. Liquidation Execution

1. On KOPLI:
   - The `DestinationContract` verifies the liquidation conditions
   - Marks the loan as liquidated
   - Emits a `LoanLiquidated` event
2. The Reactive Contract sends a cross-chain message to Ethereum Sepolia
3. On Ethereum Sepolia:
   - The `OriginContract` receives the liquidation message
   - Calls the `liquidateLoan()` function
   - Transfers the collateral to the contract owner or designated insurance fund
   - Emits a `LoanLiquidated` event

## Architecture Components

### 1. Origin Chain (Ethereum Sepolia)

- Contract: `OriginContract`
- Functions:
  - `requestLoan(uint256 _loanAmount, address _destinationChain)`
  - `depositCollateral()`
  - `releaseCollateral(address _user)`
  - `liquidateLoan(address _user)`

### 2. Reactive Network Bridge

- Contract: `ReactiveContract`
- Cross-chain Event Handlers:
  - LoanRequested handler
  - LoanInitiated handler
  - LoanFullyRepaid handler
  - LoanLiquidated handler

### 3. Destination Chain (KOPLI)

- Contract: `DestinationContract`
- Functions:
  - `requestLoan(address _borrower, uint256 _amount, uint256 _interestRate, uint256 _durationInDays, uint256 _creditScore)`
  - `fundLoan(address _borrower)`
  - `repayLoan()`
  - `liquidateLoan(address _borrower)`

## Contract Events

### OriginContract Events
```solidity
event LoanRequested(address indexed user, uint256 loanAmount, address destinationChain);
event CollateralDeposited(address indexed user, uint256 amount, address destinationChain, uint256 loanAmount);
event LoanInitiated(address indexed user, uint256 loanAmount, address destinationChain, uint256 interestRate);
event CollateralReleased(address indexed user, uint256 amount);
event LoanLiquidated(address indexed user, uint256 collateralAmount, uint256 loanAmount);
```

### DestinationContract Events
```solidity
event LoanRequested(address indexed borrower, uint256 amount, uint256 interestRate);
event LoanFunded(address indexed borrower, uint256 amount);
event LoanRepaid(address indexed borrower, uint256 amount);
event LoanFullyRepaid(address indexed borrower);
event LoanLiquidated(address indexed borrower, uint256 amount);
```

## Deployed Contract Addresses

- Sepolia OriginContract: 0x590BEff93aF028D343Fd03e958d51C123f9aB7b6
- Reactive Bridge Contract Org To Des: 0x55033f19F97b1c8d1dCA347Da2f5F5b955F4B828
- Reactive Bridge Contract Des To Des: 0xd373C76D0922857E27556eFDAD4b39C475561C20
- KOPLI MaticContract: 0x8ef4bc4EC0e3C29Ac484b1B015fd9B570133cdb6
- KOPLI DestinationContract: 0xF32c2c1cc9686D635f5D99ADb07E97a17877F134

## Example Transaction Flow

1. Loan Request (Sepolia): [0x4d2d94e6bb0349bde7796523fcafdda6fda321cec578708c33816b6607ecf2f4](https://sepolia.etherscan.io/tx/0x4d2d94e6bb0349bde7796523fcafdda6fda321cec578708c33816b6607ecf2f4)
2. Reactive Bridge Transaction OTD: 0x276b15...cf32e7a7
3. Collateral Deposit (Sepolia): [0x7d6e40b7c144e63d09be250859874d9bff1d6e19ff3ea51ed86b8d61bc8f782c](https://sepolia.etherscan.io/tx/0x7d6e40b7c144e63d09be250859874d9bff1d6e19ff3ea51ed86b8d61bc8f782c)
4. Reactive Bridge Transaction OTD: 0xcc39c3...03c70a60
5. Repay Loan (KOPLI): [0xa1b6181da7e2a9e89785a0290a84f498b6ab063689a9e9880255dfc726426f7b](https://kopli.reactscan.net/tx/0xa1b6181da7e2a9e89785a0290a84f498b6ab063689a9e9880255dfc726426f7b)
6. Reactive Bridge Transaction DTO: 0x776ce8...1ff461c4

## Security Features

- Collateral validation checks
- Cross-chain message verification
- Interest rate oracle integration
- Liquidation threshold monitoring
- Emergency pause functionality
- Access control for admin functions