import * as anchor from '@project-serum/anchor';
import { useEffect, useMemo, useState } from 'react';
import { TODO_PROGRAM_PUBKEY } from '../constants';
import { IDL as profileIdl } from '../constants/idl';
import toast from 'react-hot-toast';
import { SystemProgram } from '@solana/web3.js';
import { utf8 } from '@project-serum/anchor/dist/cjs/utils/bytes';
import { findProgramAddressSync } from '@project-serum/anchor/dist/cjs/utils/pubkey';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { authorFilter } from '../utils';

export function useTodo() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const anchorWallet = useAnchorWallet();

    const [initialized, setInitialized] = useState(false);
    const [lastTodo, setLastTodo] = useState(0);
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [transactionPending, setTransactionPending] = useState(false);
    const [input, setInput] = useState('');

    const program = useMemo(() => {
        if (anchorWallet) {
            const provider = new anchor.AnchorProvider(connection, anchorWallet, anchor.AnchorProvider.defaultOptions());
            return new anchor.Program(profileIdl, TODO_PROGRAM_PUBKEY, provider);
        }
    }, [connection, anchorWallet]);

    useEffect(() => {
        const findProfileAccounts = async () => {
            if (program && publicKey && !transactionPending) {
                try {
                    setLoading(true);
                    const [profilePda] = findProgramAddressSync(
                        [utf8.encode('USER_STATE'), publicKey.toBuffer()],
                        program.programId
                    );
                    const profileAccount = await program.account.userProfile.fetch(profilePda);

                    if (profileAccount) {
                        setLastTodo(profileAccount.lastTodo);
                        setInitialized(true);

                        const todoAccounts = await program.account.todoAccount.all([
                            authorFilter(publicKey.toString())
                        ]);
                        setTodos(todoAccounts);
                    } else {
                        setInitialized(false);
                    }
                } catch (error) {
                    console.error('Error fetching profile accounts:', error);
                    setInitialized(false);
                    setTodos([]);
                } finally {
                    setLoading(false);
                }
            }
        };

        findProfileAccounts();
    }, [publicKey, program, transactionPending]);

    const initializeUser = async () => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
                const [profilePda] = findProgramAddressSync(
                    [utf8.encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );

                await program.methods
                    .initializeUser()
                    .accounts({
                        userProfile: profilePda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId
                    })
                    .rpc();

                setInitialized(true);
                toast.success('Successfully initialized user.');
            } catch (error) {
                console.error('Error initializing user:', error);
                toast.error('Error initializing user.');
            } finally {
                setTransactionPending(false);
            }
        }
    };

    const addTodo = async () => {
        if (program && publicKey && input) {
            try {
                setTransactionPending(true);
                const [profilePda] = findProgramAddressSync(
                    [utf8.encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );
                const [todoPda] = findProgramAddressSync(
                    [utf8.encode('TODO_STATE'), publicKey.toBuffer(), Uint8Array.from([lastTodo])],
                    program.programId
                );

                await program.methods
                    .addTodo(input)
                    .accounts({
                        userProfile: profilePda,
                        todoAccount: todoPda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId
                    })
                    .rpc();

                setInput('');
                toast.success('Successfully added todo.');
            } catch (error) {
                console.error('Error adding todo:', error);
                toast.error('Error adding todo.');
            } finally {
                setTransactionPending(false);
            }
        }
    };

    const markTodo = async (todoPda, todoIdx) => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
                setLoading(true);
                const [profilePda] = findProgramAddressSync(
                    [utf8.encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );

                await program.methods
                    .markTodo(todoIdx)
                    .accounts({
                        userProfile: profilePda,
                        todoAccount: todoPda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId
                    })
                    .rpc();

                toast.success('Successfully marked todo.');
            } catch (error) {
                console.error('Error marking todo:', error);
                toast.error('Error marking todo.');
            } finally {
                setLoading(false);
                setTransactionPending(false);
            }
        }
    };

    const removeTodo = async (todoPda, todoIdx) => {
        if (program && publicKey) {
            try {
                setTransactionPending(true);
                setLoading(true);
                const [profilePda] = findProgramAddressSync(
                    [utf8.encode('USER_STATE'), publicKey.toBuffer()],
                    program.programId
                );

                await program.methods
                    .removeTodo(todoIdx)
                    .accounts({
                        userProfile: profilePda,
                        todoAccount: todoPda,
                        authority: publicKey,
                        systemProgram: SystemProgram.programId
                    })
                    .rpc();

                toast.success('Successfully removed todo.');
            } catch (error) {
                console.error('Error removing todo:', error);
                toast.error('Error removing todo.');
            } finally {
                setLoading(false);
                setTransactionPending(false);
            }
        }
    };

    const incompleteTodos = useMemo(() => todos.filter((todo) => !todo.account.marked), [todos]);
    const completedTodos = useMemo(() => todos.filter((todo) => todo.account.marked), [todos]);

    const handleChange = (event) => {
        setInput(event.target.value);
    };

    return {
        initialized,
        initializeUser,
        loading,
        transactionPending,
        completedTodos,
        incompleteTodos,
        addTodo,
        markTodo,
        removeTodo,
        input,
        handleChange
    };
}
