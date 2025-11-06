// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract OriginContract {
    AggregatorV3Interface private ethUsdPriceFeed;
    AggregatorV3Interface private maticUsdPriceFeed;
    
    uint256 public constant COLLATERALIZATION_RATIO = 150; // 150%
    uint256 public liquidationThreshold = 75; // 75%
    uint256 public ltvRatio = 50; // 50%
    
    address public owner;
    address public riskAssessmentModule;
    address public interestRateOracle;
    
    struct Loan {
        uint256 collateralAmount;
        uint256 loanAmount;
        uint256 destinationChain;
        uint256 interestRate;
        uint256 creditScore;
        uint256 durationInDays;
        bool active;
    }
    
    mapping(address => Loan) public loans;
    
    event LoanRequested(address indexed user,uint256 indexed loanAmount,uint256 indexed  durationInDays,uint256 interestRate, uint256 creditScore);
    event CollateralDeposited(address indexed user, uint256 amount, uint256 destinationChain, uint256 loanAmount);
    event LoanInitiated(address indexed user, uint256 loanAmount, uint256 destinationChain, uint256 interestRate, uint256 durationInDays);
    event CollateralReleased(address indexed user, uint256 amount);
    event LoanLiquidated(address indexed user, uint256 collateralAmount, uint256 loanAmount);
    
    
    
    constructor(address _ethUsdPriceFeed, address _maticUsdPriceFeed) payable {
        owner = msg.sender;
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        maticUsdPriceFeed = AggregatorV3Interface(_maticUsdPriceFeed);
    }
    
    receive() external payable {}
    
    
    
    function setRiskManagementAddresses(address _riskAssessmentModule, address _interestRateOracle) external {
        riskAssessmentModule = _riskAssessmentModule;
        interestRateOracle = _interestRateOracle;
    }
    
    function requestLoan(uint256 _loanAmount, uint256 _destinationChain, uint256 _durationInDays) external  {
        require(_loanAmount > 0, "Loan amount must be greater than 0");
        require(loans[msg.sender].active == false, "Existing active loan");
        
        uint256 creditScore = IRiskAssessment(riskAssessmentModule).assessCreditworthiness(msg.sender);
        uint256 interestRate = IInterestRateOracle(interestRateOracle).getInterestRate(creditScore);
        
        loans[msg.sender] = Loan({
            collateralAmount: 0,
            loanAmount: _loanAmount,
            destinationChain: _destinationChain,
            interestRate: interestRate,
            creditScore: creditScore,
            durationInDays: _durationInDays,
            active: false
        });
        
        emit LoanRequested(msg.sender,_loanAmount, interestRate, creditScore, _durationInDays);
    }
    
    function depositCollateral() external payable  {
        require(msg.value > 0, "Collateral amount must be greater than 0");
        require(loans[msg.sender].loanAmount > 0, "No loan requested");
        require(loans[msg.sender].active == false, "Loan already active");
        
        uint256 requiredCollateral = calculateRequiredCollateral(loans[msg.sender].loanAmount);
        require(msg.value >= requiredCollateral, "Insufficient collateral");
        
        loans[msg.sender].collateralAmount = msg.value;
        loans[msg.sender].active = true;
        
        emit CollateralDeposited(msg.sender, msg.value, loans[msg.sender].destinationChain, loans[msg.sender].loanAmount);
        emit LoanInitiated(msg.sender, loans[msg.sender].loanAmount, loans[msg.sender].destinationChain, loans[msg.sender].interestRate, loans[msg.sender].durationInDays);
    }
    
    function calculateRequiredCollateral(uint256 _loanAmount) public view returns (uint256) {
        uint256 loanValueUsd = (_loanAmount * uint256(getMaticPrice())) / 1e18;
        uint256 requiredCollateralUsd = (loanValueUsd * COLLATERALIZATION_RATIO) / 100;
        return (requiredCollateralUsd * 1e18) / uint256(getEthPrice());
    }
    
    function releaseCollateral(address _user) external  {
        require(loans[_user].active, "No active loan found");
        
        uint256 collateralAmount = loans[_user].collateralAmount;
        delete loans[_user];
        
        (bool sent, ) = _user.call{value: collateralAmount}("");
        require(sent, "Failed to send ETH");
        
        emit CollateralReleased(_user, collateralAmount);
    }
    
    function liquidateLoan(address _user) external  {
        Loan memory loan = loans[_user];
        require(loan.active, "No active loan found");
        
        uint256 currentCollateralValue = getCollateralValue(loan.collateralAmount);
        uint256 liquidationValue = loan.loanAmount * liquidationThreshold / 100;
        
        require(currentCollateralValue < liquidationValue, "Liquidation threshold not met");
        
        delete loans[_user];
        
        // Transfer collateral to contract owner or insurance fund
        (bool sent, ) = owner.call{value: loan.collateralAmount}("");
        require(sent, "Failed to send ETH");
        
        emit LoanLiquidated(_user, loan.collateralAmount, loan.loanAmount);
    }
    
    function calculateLoanAmount(uint256 _collateralAmount) public view returns (uint256) {
        uint256 collateralValueUsd = getCollateralValue(_collateralAmount);
        uint256 loanValueUsd = (collateralValueUsd * 100) / COLLATERALIZATION_RATIO;
        uint256 loanAmountMatic = (loanValueUsd * 1e18) / uint256(getMaticPrice());
        
        return loanAmountMatic;
    }
    
    function getCollateralValue(uint256 _collateralAmount) public view returns (uint256) {
        return (_collateralAmount * uint256(getEthPrice())) / 1e18;
    }
    
    function getEthPrice() public view returns (int) {
        (,int price,,,) = ethUsdPriceFeed.latestRoundData();
        return price;
    }
    
    function getMaticPrice() public view returns (int) {
        (,int price,,,) = maticUsdPriceFeed.latestRoundData();
        return price;
    }
    
    function getLoanDetails(address _user) external view returns (uint256, uint256, uint256, uint256, uint256,uint256, bool) {
        Loan memory loan = loans[_user];
        return (loan.collateralAmount, loan.loanAmount, loan.destinationChain, loan.interestRate, loan.creditScore,loan.durationInDays, loan.active);
    }
}

interface IRiskAssessment {
    function assessCreditworthiness(address _user) external view returns (uint256);
}

contract RiskAssessmentModule is IRiskAssessment {
    mapping(address => uint256) private userScores;

    function setUserScore(address _user, uint256 _score) external {
        require(_score <= 100, "Score must be between 0 and 100");
        userScores[_user] = _score;
    }

    function assessCreditworthiness(address _user) external view override returns (uint256) {
        if (userScores[_user] == 0) {
            return 50; // Default score for new users
        }
        return userScores[_user];
    }
}

interface IInterestRateOracle {
    function getInterestRate(uint256 _creditScore) external view returns (uint256);
}

contract InterestRateOracle is IInterestRateOracle {
    function getInterestRate(uint256 _creditScore) external pure override returns (uint256) {
        if (_creditScore >= 80) return 500; // 5%
        if (_creditScore >= 60) return 800; // 8%
        return 1200; // 12% for low credit scores
    }
}