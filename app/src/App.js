import './App.css';
import { useEffect, useState } from 'react'
import {Connection, PublicKey, clusterApiUrl} from '@solana/web3.js'
import {
  Program,
  AnchorProvider,
  utils,
  BN,
  web3
} from '@project-serum/anchor'
import idl from './crowdfund.json'
import {Buffer} from 'buffer'
window.Buffer = Buffer

const {SystemProgram} = web3
const programId = new PublicKey(idl.metadata.address)
const network = clusterApiUrl('devnet')
const opts = {
  preflightCommitment: 'processed', // to be confirmed by whole network use finalized, this only is confirmed by node
}
const App = () => {
  const [walletAddress, setWalletAddress] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const getProvider = ()=>{
    const connection = new Connection(network, opts.preflightCommitment)
    const provider = new AnchorProvider(connection, window.solana, opts.preflightCommitment)
    return provider
  }
  const checkIfWalletIsConnected = async () => {
    try {
      const {solana} = window
      if(solana){
        if(solana.isPhantom) console.log('Phantom wallet found')
        const response = await solana.connect({
          onlyIfTrusted: true
        })
        console.log('Connected with public key: ', response.publicKey.toString())
        setWalletAddress(response.publicKey.toString())
      }else alert('Install phantom wallet')
    } catch (error) {
      console.log(error)
    }
  }
  const connectWallet = async()=>{
    const {solana} = window
    if(solana){
      const response = await solana.connect()
      console.log('Connected with public key: ', response.publicKey.toString())
      setWalletAddress(response.publicKey.toString())
    }
  }
  const createCampaign = async()=>{
    try {
      const provider = getProvider()
      const program = new Program(idl, programId, provider)
      const [campaign] = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode('CAMPAIGN_DEMO'),
          provider.wallet.publicKey.toBuffer()
        ],
        program.programId
      )
      await program.rpc.create('Campaign name', 'Campaign description', {
        accounts: {
          campaign,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId
        }
      })
      console.log('Campaign created at addr: ', campaign.toString())
    } catch (error) {
      console.error('Error creating campaign: ', error)
    }
  }
  const getCampaigns = async()=>{
    const connection = new Connection(network, opts.preflightCommitment)
    const provider = getProvider()
    const program = new Program(idl, programId, provider)
    Promise.all((await connection.getProgramAccounts(programId)).map(async campaign => ({
      ...(await program.account.campaign.fetch(campaign.pubkey)),
      pubkey: campaign.pubkey
    }))).then((campaigns)=> setCampaigns(campaigns))
  }
  
  const donate = async(publicKey)=>{
    try {
      const provider = getProvider()
      const program = new Program(idl, programId, provider)
      await program.rpc.donate(new BN(0.2*web3.LAMPORTS_PER_SOL), {
        accounts: {
          campaign: publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId
        }
      })
      console.log('Withdrawed money from campaign @', publicKey.toString())
      getCampaigns()
    } catch (error) {
      console.error('Error donating: ',error)
    }
  }

  const withdraw = async(publicKey)=>{
    try {
      const provider = getProvider()
      const program = new Program(idl, programId, provider)
      await program.rpc.withdraw(new BN(0.2*web3.LAMPORTS_PER_SOL), {
        accounts: {
          campaign: publicKey,
          user: provider.wallet.publicKey,
        }
      })
      console.log('Donated money to campaign @', publicKey.toString())
      getCampaigns()
    } catch (error) {
      console.error('Error donating: ',error)
    }
  }

  const renderNotConnectedContainer = () => {
    return (<button onClick={connectWallet}>Connect to Wallet</button>)
  }
  const renderConnectedContainer = () => {
    return (
      <>
        <button onClick={createCampaign}>Create Campaign</button>
        <button onClick={getCampaigns}>Get Campaigns</button>
        <br/>
        {campaigns.map((campaign)=>(
          <div key={campaign.pubkey.toString()}>
            <p>Campaign ID: {campaign.pubkey.toString()}</p>
            <p>
              Balance: {''}
              {(
                campaign.amountDonated/web3.LAMPORTS_PER_SOL
              ).toString()}
            </p>
            <p>{campaign.name}</p>
            <p>{campaign.description}</p>
            <button onClick={()=>donate(campaign.pubkey)}>Click to Donate</button>
            <button onClick={()=>withdraw(campaign.pubkey)}>Click to Withdraw</button>
            <br/>
          </div>
        ))}
      </>
    )
  }
  useEffect(()=>{
    const onLoad = async()=>{
      await checkIfWalletIsConnected()
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  },[])

  return <div className='App'>
    {!walletAddress && renderNotConnectedContainer()}
    {walletAddress && renderConnectedContainer()}
  </div>;
}

export default App;
