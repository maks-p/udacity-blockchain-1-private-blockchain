/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {
	/**
	 * Constructor of the class, you will need to setup your chain array and the height
	 * of your chain (the length of your chain array).
	 * Also everytime you create a Blockchain class you will need to initialized the chain creating
	 * the Genesis Block.
	 * The methods in this class will always return a Promise to allow client applications or
	 * other backends to call asynchronous functions.
	 */
	constructor() {
		this.chain = [];
		this.height = -1;
		this.initializeChain();
	}

	/**
	 * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
	 * You should use the `addBlock(block)` to create the Genesis Block
	 * Passing as a data `{data: 'Genesis Block'}`
	 */
	async initializeChain() {
		if (this.height === -1) {
			let block = new BlockClass.Block({ data: 'Genesis Block' });
			await this._addBlock(block);
		}
	}

	/**
	 * Utility method that return a Promise that will resolve with the height of the chain
	 */
	getChainHeight() {
		return new Promise((resolve, reject) => {
			resolve(this.height);
		});
	}

	/**
	 * _addBlock(block) will store a block in the chain
	 * @param {*} block
	 * The method will return a Promise that will resolve with the block added
	 * or reject if an error happen during the execution.
	 * You will need to check for the height to assign the `previousBlockHash`,
	 * assign the `timestamp` and the correct `height`...At the end you need to
	 * create the `block hash` and push the block into the chain array. Don't for get
	 * to update the `this.height`
	 * Note: the symbol `_` in the method name indicates in the javascript convention
	 * that this method is a private method.
	 */
	_addBlock(block) {
		let self = this;
		return new Promise(async (resolve, reject) => {
			// Get chain height
			const chainHeight = await self.getChainHeight();

			// If chain height = -1, this is the Genesis Block, no previous block hash
			if (chainHeight > -1) {
				// If chain heigh greater than 1, then add the previousBlockHash
				block.previousBlockHash = self.chain[chainHeight].hash;
			}

			// Set time, height, hash of new Block
			block.time = new Date().getTime().toString().slice(0, -3);
			block.height = chainHeight + 1;
			block.hash = SHA256(JSON.stringify(block)).toString();

			if (block) {
        console.log(block)
				// Update the chain height
				this.height = chainHeight + 1;

				// Push block onto chain
				self.chain.push(block);

				// Validate Chain
				const validationErrors = await self.validateChain();
        if (validationErrors.length === 0) {
				  resolve(block);
        } else {
          reject('Unable to validate chain');
        }
			} else {
				reject('Something bad happened');
			}
		});
	}

	/**
	 * The requestMessageOwnershipVerification(address) method
	 * will allow you  to request a message that you will use to
	 * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
	 * This is the first step before submit your Block.
	 * The method return a Promise that will resolve with the message to be signed
	 * @param {*} address
	 */
	requestMessageOwnershipVerification(address) {
		return new Promise((resolve) => {
			resolve(
				`${address}:${new Date()
					.getTime()
					.toString()
					.slice(0, -3)}:starRegistry`
			);
		});
	}

	/**
	 * The submitStar(address, message, signature, star) method
	 * will allow users to register a new Block with the star object
	 * into the chain. This method will resolve with the Block added or
	 * reject with an error.
	 * Algorithm steps:
	 * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
	 * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
	 * 3. Check if the time elapsed is less than 5 minutes
	 * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
	 * 5. Create the block and add it to the chain
	 * 6. Resolve with the block added.
	 * @param {*} address
	 * @param {*} message
	 * @param {*} signature
	 * @param {*} star
	 */
	submitStar(address, message, signature, star) {
		let self = this;
		return new Promise(async (resolve, reject) => {
			// Extract time from message
			const messageTime = parseInt(message.split(':')[1]);

			// Get current time
			const currentTime = parseInt(
				new Date().getTime().toString().slice(0, -3)
			);
			const diff = currentTime - messageTime;

			// Reject if 5 minutes or more has elapsed
			if (diff >= 5 * 60) {
				reject('Time elapsed greater than 5 minutes');
			}

			if (bitcoinMessage.verify(message, address, signature)) {
				const data = { owner: address, star };

				// Add new Block
				const newBlock = await self._addBlock(new BlockClass.Block(data));
				resolve(newBlock);
			} else {
				reject('Unable to verify signature');
			}
		});
	}

	/**
	 * This method will return a Promise that will resolve with the Block
	 *  with the hash passed as a parameter.
	 * Search on the chain array for the block that has the hash.
	 * @param {*} hash
	 */
	getBlockByHash(hash) {
		let self = this;
		return new Promise((resolve, reject) => {
			const block = self.chain.filter((p) => p.hash === hash)[0];
			if (block) {
				resolve(block);
			} else {
				resolve(null);
			}
		});
	}

	/**
	 * This method will return a Promise that will resolve with the Block object
	 * with the height equal to the parameter `height`
	 * @param {*} height
	 */
	getBlockByHeight(height) {
		let self = this;
		return new Promise((resolve, reject) => {
			let block = self.chain.filter((p) => p.height === height)[0];
			if (block) {
				resolve(block);
			} else {
				resolve(null);
			}
		});
	}

	/**
	 * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
	 * and are belongs to the owner with the wallet address passed as parameter.
	 * Remember the star should be returned decoded.
	 * @param {*} address
	 */
	getStarsByWalletAddress(address) {
		let self = this;
		let stars = [];
		return new Promise(async (resolve, reject) => {
			for (let block of self.chain) {
				const star = await block.getBData();
				if (star) {
					if (star.owner === address) {
						stars.push(star);
					}
				}
			}
			resolve(stars);
		});
	}

	validateChain() {
		let self = this;
		let errorLog = [];
		return new Promise(async (resolve, reject) => {
			// Validate chain after Genesis Block
			const nonGenesisChain = self.chain.slice(1);
			for (let block of nonGenesisChain) {
				// Check that each block is valid
				if (!block.validate()) {
					errorLog.push('Block invalid');
				}
				// Variable with previous block hash
				const prevHash = self.chain[block.height - 1].hash;

				// Check that previousBlockHash is the previous Block's hash
				if (block.previousBlockHash !== prevHash) {
					errorLog.push('Chain invalid - Previous Hash Error');
				}
			}
			resolve(errorLog);
		});
	}
}

module.exports.Blockchain = Blockchain;
