import React from 'react';
import { useState } from 'react';
import { Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';


const App = () => {
    /// wallet connection to phantom
    const [walletConnected, setWalletConnected] = useState(false);
    const [provider, setProvider] = useState();
    const [loading, setLoading] = useState();

    const getProvider = async () => {
        if ("solana" in window) {
            const provider = window.solana; 
            if (provider.isPhantom) {
                return provider;
            }
        } else{
            window.open("https://www.phantom.app/","_blank");
        }
    };

    const walletConnectionHelper = async () => {
        if (walletConnected) {
            //Disconnect wallet
            setProvider();
            setWalletConnected(false);

        } else {
            const userWallet = await getProvider();
            if (userWallet) {
                await userWallet.connect();
                userWallet.on("connect", async () => {
                    setProvider(userWallet);
                    setWalletConnected(true);
                });
            }
        }
    }

    //// create a airdrop 
    const airDropHelper = async () =>{
        try {
            setLoading(true);
            const connection = new Connection(
                clusterApiUrl("devnet"),
                "confirmed"
            );

            const fromAirDropSignature = await connection.requestAirdrop(new PublicKey(provider.publicKey), LAMPORTS_PER_SOL);
            await connection.confirmTransaction(fromAirDropSignature, { commitment:"confirmed"});

            console.log(`1 SOL airdropped to your wallet ${provider.publicKey.toString()} successfully`);
            setLoading(false);
        } catch(err) {
            console.log(err);
            setLoading(false);
        }
    }


    /// for minting a new token

    const [isTokenCreated, setIsTokenCreated] = useState(false);
    const [createdTokenPublicKey, setCreatedTokenPublicKey] = useState(null);
    const [mintingWalletSecretKey, setMintingWalletSecretKey] = useState(null);

    const initialMintHelper = async () => {
        try {
            setLoading(true);
            const connection = new Connection(
                clusterApiUrl('devnet'),
                "confirmed"
            );
            const mintRequester = await provider.publicKey;
            const mintingFromWallet = await Keypair.generate();
            setMintingWalletSecretKey(JSON.stringify(mintingFromWallet.secretKey));

            const fromAirDropSignature = await connection.requestAirdrop(mintingFromWallet.publicKey, LAMPORTS_PER_SOL);
            await connection.confirmTransaction(fromAirDropSignature, { commitment:"confirmed" });

            const creatorToken = await Token.createMint(connection, mintingFromWallet, mintingFromWallet.publicKey, null, 6, TOKEN_PROGRAM_ID);
            const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintingFromWallet.publicKey);
            await creatorToken.mintTo(fromTokenAccount.address, mintingFromWallet.publicKey, [], 1000000);

            const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);
            const transaction = new Transaction().add(
                Token.createTransferInstruction(
                    TOKEN_PROGRAM_ID,
                    fromTokenAccount.address,
                    toTokenAccount.address,
                    mintingFromWallet.publicKey,
                    [],
                    1000000
                )
            );
            const signature=await sendAndConfirmTransaction(connection, transaction, [mintingFromWallet], { commitment: "confirmed" });
            
            console.log("SIGNATURE:",signature);
       
            setCreatedTokenPublicKey(creatorToken.publicKey.toString());
            setIsTokenCreated(true);
            setLoading(false);
        } catch(err){
            console.log(err)
            setLoading(false);
        }
    };

    //// for minting more tokens

    const [supplyCapped,setSupplyCapped]=useState(false);

    const mintAgainHelper = async () => {
        try {
            setLoading(true);
            const connection = new Connection(
                clusterApiUrl("devnet"),
                "confirmed"
            );
            const createMintingWallet = await Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
            const mintRequester = await provider.publicKey;
            
            const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey,LAMPORTS_PER_SOL);
            await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });
            
            const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
            const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(createMintingWallet.publicKey);
            const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(mintRequester);
            await creatorToken.mintTo(fromTokenAccount.address, createMintingWallet.publicKey, [], 100000000);
            
            const transaction = new Transaction().add(
                Token.createTransferInstruction(
                    TOKEN_PROGRAM_ID,
                    fromTokenAccount.address,
                    toTokenAccount.address,
                    createMintingWallet.publicKey,
                    [],
                    100000000
                )
            );
            await sendAndConfirmTransaction(connection, transaction, [createMintingWallet], { commitment: "confirmed" });
            
            setLoading(false);
        } catch(err) {
            console.log(err);
            setLoading(false);
        }
     };


     //// send tokens to your friends wallet
     const transferTokenHelper = async () => {
        try {
           setLoading(true);
           
           const connection = new Connection(
              clusterApiUrl("devnet"),
              "confirmed"
           );
           
           const createMintingWallet = Keypair.fromSecretKey(Uint8Array.from(Object.values(JSON.parse(mintingWalletSecretKey))));
           const receiverWallet = new PublicKey("*******************************************************");
           
           const fromAirDropSignature = await connection.requestAirdrop(createMintingWallet.publicKey, LAMPORTS_PER_SOL);
           await connection.confirmTransaction(fromAirDropSignature, { commitment: "confirmed" });
           console.log('1 SOL airdropped to the wallet for fee');
           
           const creatorToken = new Token(connection, createdTokenPublicKey, TOKEN_PROGRAM_ID, createMintingWallet);
           const fromTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(provider.publicKey);
           const toTokenAccount = await creatorToken.getOrCreateAssociatedAccountInfo(receiverWallet);
           
           const transaction = new Transaction().add(
                Token.createTransferInstruction(TOKEN_PROGRAM_ID, fromTokenAccount.address, toTokenAccount.address, provider.publicKey, [], 10000000)
                );
           transaction.feePayer=provider.publicKey;
           let blockhashObj = await connection.getRecentBlockhash();
           console.log("blockhashObj", blockhashObj);
           transaction.recentBlockhash = await blockhashObj.blockhash;
     
           if (transaction) {
              console.log("Txn created successfully");
           }
           
           let signed = await provider.signTransaction(transaction);
           let signature = await connection.sendRawTransaction(signed.serialize());
           await connection.confirmTransaction(signature);
           
           console.log("SIGNATURE: ", signature);
           setLoading(false);
        } catch(err) {
           console.log(err)
           setLoading(false);
        }
     }

  return (
    <div>
      <h1>Create your own tokens using javascript</h1>
      <button onClick={walletConnectionHelper} disabled={loading}>{!walletConnected?"Connect Wallet":"Disconnect Wallet"}</button>  
    {
        walletConnected ? (
            <p>
                <p><strong>Public Key: </strong>{provider.publicKey.toString()} </p>
                <li>Airdrop 1 SOL into my wallet: <button disabled={loading} onClick={airDropHelper}>AirDrop SOL</button>
                </li>
                {/* <button disabled={loading} onClick={initialMintHelper}>Intial Mint</button> */}
                <li>Mint More 100 tokens: <button disabled={loading || supplyCapped} onClick={mintAgainHelper}>Mint Again</button></li>
                <li>Trasfer token to friends: <button disabled={loading} onClick={transferTokenHelper}> Trasnfer it </button></li>
            </p>
        ):<></>
    }
    
    </div>)
};

export default App;
