// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MATIC", "MAT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
}