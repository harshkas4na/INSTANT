// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MATIC.sol";

contract DestinationContract  {
    LendingToken public lendingToken;
    
    struct Loan {
        uint256 amount;
        uint256 repaidAmount;
        uint256 interestRate;
        uint256 dueDate;
        uint256 creditScore;
        bool active;
        bool funded;
    }
    
    mapping(address => Loan) public loans;
    
    uint256 public liquidationThreshold = 75; // 75%
    uint256 public ltvRatio = 50; // 50%
    
    event LoanRequested(address indexed borrower, uint256 amount, uint256 interestRate);
    event LoanFunded(address indexed borrower, uint256 amount);
    event LoanRepaid(address indexed borrower, uint256 amount);
    event LoanFullyRepaid(address indexed borrower);
    event LoanLiquidated(address indexed borrower, uint256 amount);
    
    
    constructor(address _lendingToken) payable {
        lendingToken = LendingToken(_lendingToken);
    }
    
    receive() external payable {}
    
    
    function requestLoan(address _borrower, uint256 _amount, uint256 _interestRate, uint256 _durationInDays, uint256 _creditScore) external  {
        require(loans[_borrower].active == false, "Borrower has an active loan");
        
        loans[_borrower] = Loan({
            amount: _amount,
            repaidAmount: 0,
            interestRate: _interestRate,
            dueDate: block.timestamp + (_durationInDays * 1 days),
            creditScore: _creditScore,
            active: true,
            funded: false
        });
        
        emit LoanRequested(_borrower, _amount, _interestRate);
    }
    
    function fundLoan(address _borrower) external  {
        Loan storage loan = loans[_borrower];
        require(loan.active && !loan.funded, "Loan is not active or already funded");
        
        // Mark as funded before transfer to prevent reentrancy
        loan.funded = true;
        
        // Transfer tokens to borrower
        lendingToken.mint(_borrower, loan.amount);
        
        emit LoanFunded(_borrower, loan.amount);
    }
    
    // Add helper function to check loan status
    function getLoanStatus(address _borrower) external view returns (
        bool isActive,
        bool isFunded,
        uint256 loanAmount,
        uint256 contractBalance
    ) {
        Loan memory loan = loans[_borrower];
        return (
            loan.active,
            loan.funded,
            loan.amount,
            lendingToken.balanceOf(address(this))
        );
    }
    
    function repayLoan(uint256 _amount) external {
        Loan storage loan = loans[msg.sender];
        require(loan.active && loan.funded, "No active funded loan found");
        require(_amount > 0, "Repayment amount must be greater than 0");
        
        uint256 totalDue = calculateTotalDue(msg.sender);
        require(_amount <= totalDue, "Repayment amount exceeds total due");
        
        lendingToken.burn(msg.sender, _amount);
        
        loan.repaidAmount += _amount;
        emit LoanRepaid(msg.sender, _amount);
        
        if (loan.repaidAmount >= totalDue) {
            loan.active = false;
            emit LoanFullyRepaid(msg.sender);
            
            uint256 overpayment = loan.repaidAmount - totalDue;
            if (overpayment > 0) {
               lendingToken.mint(msg.sender, overpayment);
            }
        }
    }
    
    function liquidateLoan(address _borrower) external  {
        Loan storage loan = loans[_borrower];
        require(loan.active && loan.funded, "No active funded loan found");
        
        uint256 totalDue = calculateTotalDue(_borrower);
        uint256 liquidationValue = totalDue * liquidationThreshold / 100;
        
        require(loan.repaidAmount < liquidationValue, "Liquidation threshold not met");
        
        uint256 liquidationAmount = totalDue - loan.repaidAmount;
        loan.active = false;
        
        emit LoanLiquidated(_borrower, liquidationAmount);
    }
    
    function calculateTotalDue(address _borrower) public view returns (uint256) {
        Loan memory loan = loans[_borrower];
        if (!loan.active || !loan.funded) return 0;
        
        uint256 principal = loan.amount;
        
        // Calculate time elapsed since loan start (30 days before due date)
        uint256 loanStartTime = loan.dueDate - 30 days;
        uint256 timeElapsed;
        
        if (block.timestamp > loanStartTime) {
            timeElapsed = block.timestamp - loanStartTime;
        } else {
            timeElapsed = 0;
        }
        
        // Calculate interest with safe math
        uint256 interest = (principal * loan.interestRate * timeElapsed) / (365 days * 10000);
        
        // Calculate total due
        uint256 totalDue = principal + interest;
        
        // Ensure we don't underflow when subtracting repaid amount
        if (totalDue > loan.repaidAmount) {
            return totalDue - loan.repaidAmount;
        } else {
            return 0;
        }
    }
    
    function getLoanDetails(address _borrower) external view returns (uint256, uint256, uint256, uint256, uint256, bool, bool) {
        Loan memory loan = loans[_borrower];
        return (loan.amount, loan.repaidAmount, loan.interestRate, loan.dueDate, loan.creditScore, loan.active, loan.funded);
    }
    
}