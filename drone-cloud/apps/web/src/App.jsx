import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const mapInstanceRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    const L = window.L
    if (!L || mapInstanceRef.current) return

    // Montreal coordinates
    const montrealLat = 45.5017
    const montrealLng = -73.5673

    // Initialize map
    const map = L.map('map', {
      center: [montrealLat, montrealLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    })
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
    }).addTo(map)

    // Use a simple default marker (red pin)
    const drone = L.marker([montrealLat, montrealLng]).addTo(map)
    drone.bindPopup('Drone 1')

    // Add pads
    L.circleMarker([45.5017, -73.5673], { color: 'green', radius: 10 })
      .bindPopup('Pad 1')
      .addTo(map)
    L.circleMarker([45.5117, -73.5573], { color: 'green', radius: 10 })
      .bindPopup('Pad 2')
      .addTo(map)
    L.circleMarker([45.4917, -73.5773], { color: 'green', radius: 10 })
      .bindPopup('Pad 3')
      .addTo(map)

    // Movement
    intervalRef.current = setInterval(() => {
      const newLat = montrealLat + (Math.random() - 0.5) * 0.02
      const newLng = montrealLng + (Math.random() - 0.5) * 0.02
      drone.setLatLng([newLat, newLng])
      console.log('Drone moved to:', newLat, newLng)
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold underline">
          Drone Cloud Platform
        </h1>
        <p>Welcome to the AWS for drones!</p>
        <div id="map" className="drone-map" />
      </div>
    </>
  )
}

export default App
