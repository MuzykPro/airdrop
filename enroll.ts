import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import AppSolana from '@ledgerhq/hw-app-solana';
import { assert } from "console";
import { IDL, Turbin3Prereq } from "./programs/Turbin3_prereq";

const SOLANA_PATH = "44'/501'/0'";

(async () => {
    const connection = new Connection("https://api.devnet.solana.com");

    const github = Buffer.from("MuzykPro", "utf8");

    const transport = await TransportNodeHid.create();
    const solanaApp = new AppSolana(transport);

    const { address: pubKeyBytes } = await solanaApp.getAddress(SOLANA_PATH);
    const fromPubKey = new PublicKey(pubKeyBytes);
    console.log("Ledger Public Key:", fromPubKey.toBase58());


    const dummyKeypair = Keypair.generate(); // won't be used
    const dummyWallet = new Wallet(dummyKeypair);

    const provider = new AnchorProvider(connection, dummyWallet, {
        commitment: "confirmed"
    });
    const program: Program<Turbin3Prereq> = new Program(IDL, provider);

    const enrollment_seeds = [Buffer.from("preQ225"), pubKeyBytes];
    const [enrollment_key, _bump] = PublicKey.findProgramAddressSync(enrollment_seeds, program.programId);

    try {
        const tx = await program.methods
            .submit(github)
            .accounts({
                signer: fromPubKey,
                prereq: enrollment_key,
                system_program: SystemProgram.programId
            } as any)
            .transaction();
        const latestBlockhash = await connection.getLatestBlockhash();
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = fromPubKey;
        const serializedMessage = tx.serializeMessage();
        const signature = await solanaApp.signTransaction(SOLANA_PATH, serializedMessage);
        console.log("Transaction signed.");
        tx.addSignature(fromPubKey, Buffer.from(signature.signature));
        if (!tx.verifySignatures()) {
            throw new Error("Ledger signature is invalid");
        }
        console.log("Sending tx...");
        const txHash = await connection.sendRawTransaction(tx.serialize());

        console.log(`Success! Check out your TX here:
        https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    } catch (e) {
        console.error(`Oops, something went wrong: ${e}`)
    }

})();



