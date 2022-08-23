import { ChangeEvent, useEffect, useState } from 'react'
import Web3 from 'web3'
import './App.css'

enum AsyncStatus {
  Idle,
  Loading,
  Success,
  Error,
}

type AsyncData<Data> =
  | {
      status: AsyncStatus.Idle
    }
  | {
      status: AsyncStatus.Loading
    }
  | {
      status: AsyncStatus.Success
      data: Data
    }
  | {
      status: AsyncStatus.Error
      error: any
    }

type Connection = AsyncData<{ web3: Web3; address: string }>
type Balance = AsyncData<string>
type Signed = AsyncData<string>

async function getRecentTransactions(
  address: string,
  page: number,
  offset: number,
) {
  const response = await fetch(
    `https://api-kovan.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&page=${page}&offset=${offset}&apikey=GT3Z5P839FV1MUH9JJE6FEERDXXUIYDAQ9`,
  )

  const json = await response.json()
  if (json.message !== 'OK') {
    throw new Error(json.result)
  }
  return json.result as Object[]
}

async function isMetaMaskConnected() {
  const { ethereum } = window
  const accounts = (await ethereum.request({
    method: 'eth_accounts',
  })) as string[]
  return accounts && accounts.length > 0
}

function App() {
  const metaMaskInstalled = typeof window.ethereum !== 'undefined'

  const [connection, setConnection] = useState<Connection>({
    status: AsyncStatus.Idle,
  })

  useEffect(() => {
    const handleAccountsChanged = async () => {
      const connected = await isMetaMaskConnected()

      if (!connected) {
        setConnection({ status: AsyncStatus.Idle })
      }
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)

    return () => {
      // window.ethereum.off('accountsChanged', handleAccountsChanged)
    }
  }, [])
  const handleConnect = async () => {
    setConnection({ status: AsyncStatus.Loading })
    try {
      const addresses = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]
      const web3 = new Web3(window.ethereum as any)
      ;(window as any).web3 = web3
      console.log({ web3 })
      setConnection({
        status: AsyncStatus.Success,
        data: {
          web3,
          address: addresses[0],
        },
      })
    } catch (error) {
      setConnection({ status: AsyncStatus.Error, error })
    }
  }

  let main
  switch (connection.status) {
    case AsyncStatus.Idle:
      main = <button onClick={handleConnect}>Connect to MetaMask</button>
      break
    case AsyncStatus.Loading:
      main = <button disabled>Connecting...</button>
      break
    case AsyncStatus.Success:
      main = (
        <Connected
          address={connection.data.address}
          web3={connection.data.web3}
        />
      )
      break
    case AsyncStatus.Error:
      main = (
        <div style={{ color: 'red' }}>Error: {connection.error.toString()}</div>
      )
      break
  }

  return metaMaskInstalled ? main : <div>Please install MetaMask first.</div>
}

function Connected({ web3, address }: { web3: Web3; address: string }) {
  return (
    <div>
      <h2>Current address: {address}</h2>
      <Balance address={address} web3={web3} />
      <Sign address={address} web3={web3} />
      <RecentTransactions limit={5} address={address} />
    </div>
  )
}

// Seems it's pretty hard to do without third-party service: https://github.com/ChainSafe/web3.js/issues/580
function RecentTransactions({
  address,
  limit,
}: {
  address: string
  limit: number
}) {
  const [transactions, setTransactions] = useState<AsyncData<Object[]>>({
    status: AsyncStatus.Idle,
  })
  const handleGetTransactions = async () => {
    setTransactions({ status: AsyncStatus.Loading })
    try {
      const data = await getRecentTransactions(address, 1, limit)
      setTransactions({ status: AsyncStatus.Success, data })
    } catch (error) {
      setTransactions({ status: AsyncStatus.Error, error })
    }
  }
  return (
    <div className="section">
      <button onClick={handleGetTransactions}>
        get last {limit} transactions
      </button>
      {transactions.status === AsyncStatus.Success && (
        <pre style={{ textAlign: 'start' }}>
          <code>{JSON.stringify(transactions.data, null, 4)}</code>
        </pre>
      )}
    </div>
  )
}

function Sign({ web3, address }: { web3: Web3; address: string }) {
  const [raw, setRaw] = useState('')
  const [signed, setSigned] = useState<Signed>({
    status: AsyncStatus.Idle,
  })

  const handleSign = async () => {
    setSigned({ status: AsyncStatus.Loading })
    try {
      const data = await web3.eth.personal.sign(raw, address, 'test password!')
      setSigned({ status: AsyncStatus.Success, data })
    } catch (error) {
      setSigned({ status: AsyncStatus.Error, error })
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value)
  }

  let signedContent = ''
  switch (signed.status) {
    case AsyncStatus.Idle:
      signedContent = 'not loaded'
      break
    case AsyncStatus.Loading:
      signedContent = 'loading'
      break

    case AsyncStatus.Success:
      signedContent = `signed: ${signed.data}`
      break
  }

  return (
    <div className="section">
      <input value={raw} onChange={handleChange} placeholder="enter raw text" />
      <button onClick={handleSign}>sign</button>
      <div>{signedContent}</div>
    </div>
  )
}

function Balance({ web3, address }: { web3: Web3; address: string }) {
  const [balance, setBalance] = useState<Balance>({ status: AsyncStatus.Idle })

  const handleGetBalance = async () => {
    setBalance({ status: AsyncStatus.Loading })
    try {
      const balance = await web3.eth.getBalance(address)
      setBalance({ status: AsyncStatus.Success, data: balance })
    } catch (error) {
      setBalance({ status: AsyncStatus.Error, error })
    }
  }

  let balanceContent = ''
  switch (balance.status) {
    case AsyncStatus.Idle:
      balanceContent = 'not loaded'
      break
    case AsyncStatus.Loading:
      balanceContent = 'loading'
      break

    case AsyncStatus.Success:
      balanceContent = web3.utils.fromWei(balance.data)
      break
  }

  return (
    <div className="section">
      <button onClick={handleGetBalance}>Get Balance</button>
      <div>Balance: {balanceContent}</div>
    </div>
  )
}

export default App
