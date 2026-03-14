import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold underline">
          Drone Cloud Platform
        </h1>
        <p>Welcome to the AWS for drones!</p>
      </div>
    </>
  )
}

export default App