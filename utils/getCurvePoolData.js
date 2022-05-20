const addresses = require("../addresses/curvePool") // Get all relevant Ethereum and avax addresses
const curveLPAbi = require("../abi/CurveLPAbi.json") // Get the token ABI for the project. ABIs can be found on the Etherscan page for the contract if the contract has been verified. Otherwise you may need to ask your Solidity dev for it.
const ERC20Abi = require("../abi/ERC20Abi.json")

const numeral = require("numeral") // NPM package for formatting numbers
const db = require("./db") // Util for setting up DB and main DB methods
const SECONDS_PER_YEAR = 31622400
const apyUtils = require("./apyUtils")
// Async function which takes in web3 collection, makes web3 calls to get current on chain data, formats data, and caches formatted data to MongoDB
const getCurvePoolData = async (web3s) => {
    // Unpack web3 objects for Ethereum and avax
    const {
        avax_web3
    } = web3s
    // // Get Ethereum block number 
    // const blockNumber = await web3.eth.getBlockNumber()

    let avax_blockNumber
    try {
        avax_blockNumber = await avax_web3.eth.getBlockNumber()
    } catch (err) {
        avax_blockNumber = 0
        console.log("CANT GET avax_blockNumber")
        console.log(err)
    }
    // Collect addresses in one 'addresses' object
    const {
        avax_addresses
    } = addresses
    // Set number formatting default
    numeral.defaultFormat("0,0");

    // Instantiate all smart contract object(s)

    // web3.eth.Contract() creates a smart contract object using the ABI and address of the contract which allows you to call all the smart contract functions listed in the ABI. Since we are not supplying a private key to our web3 object, we can only use it for reading on chain data, not for anything requiring signing - which is all we need for this project.
    // Here we instantiate the Ethereum smart contract object
    let LPToken = new avax_web3.eth.Contract(curveLPAbi, avax_addresses.YUSDPoolAddress)

    // For converting to proper number of decimals. We use this to convert from raw numbers returned from web3 calls to human readable formatted numbers based on the decimals for each token.  
    const convert = (num, decimal) => {
        return Math.round((num / (10 * 10 ** (decimal - 3)))) / 100
    }

    // Make tokenData object. This object is used for storing formatted and calculated results from web3 calls from both Ethereum and avax web3 objects. It is divided into 3 sections for data on avax, Ethereum, and aggregate data from both chains in 'combined'.

    let Data = {
        liquidity: {
            value: null,
            usd: null,
            description: "Total liquidity in Curve YUSD Pool"
        }

    }

    const totalSupply = Number(await LPToken.methods.totalSupply().call())/ 10 ** 18
    const virtualPrice = Number(await LPToken.methods.get_virtual_price().call()) / 10 ** 18

    Data.liquidity.value = totalSupply
    Data.liquidity.usd = totalSupply * virtualPrice

    Object.keys(Data).forEach(key => {
        Data[key].block = avax_blockNumber
        Data[key].timestamp = Date()
    })

    // Finally after all data has been collected and formatted, we set up our database object and call db.updateYETIData() in order to cache our data in our MongoDB database.

    try {
        const client = db.getClient()
        db.updateCurvePoolData(Data, client)
    } catch (err) {
        console.log(err)
    }
}

module.exports = getCurvePoolData