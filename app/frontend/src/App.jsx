import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')

  const [cart, setCart] = useState([])

  // Checkout details
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const [orderError, setOrderError] = useState('')

  // Order history
  const [historyPhone, setHistoryPhone] = useState('')
  const [orders, setOrders] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historySearched, setHistorySearched] = useState(false)

  // Load restaurants
  useEffect(() => {
    fetch('/api/restaurants')
      .then(response => {
        if (!response.ok) throw new Error('API request failed')
        return response.json()
      })
      .then(data => setRestaurants(data))
      .catch(() => setError('Unable to load restaurants'))
      .finally(() => setLoading(false))
  }, [])

  // Load restaurant menu
  async function viewRestaurant(restaurant) {
    setSelectedRestaurant(restaurant)
    setMenuItems([])
    setMenuError('')
    setMenuLoading(true)
    setOrderMessage('')
    setOrderError('')

    try {
      const response = await fetch(
        `/api/restaurants/${restaurant.id}/menu`
      )

      if (!response.ok) throw new Error('Unable to load menu')

      const data = await response.json()
      setMenuItems(data)
    } catch (err) {
      setMenuError(err.message)
    } finally {
      setMenuLoading(false)
    }
  }

  // Add food to cart
  function addToCart(item) {
    setOrderMessage('')
    setOrderError('')

    setCart(previousCart => {
      const existingItem = previousCart.find(
        cartItem => cartItem.id === item.id
      )

      if (existingItem) {
        return previousCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      }

      return [...previousCart, { ...item, quantity: 1 }]
    })
  }

  // Increase or decrease quantity
  function updateQuantity(itemId, change) {
    setCart(previousCart =>
      previousCart
        .map(item =>
          item.id === itemId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter(item => item.quantity > 0)
    )
  }

  // Calculate cart count and total
  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.quantity,
    0
  )

  // Place order
  async function placeOrder() {
    setOrderMessage('')
    setOrderError('')

    if (
      !customerName.trim() ||
      !customerPhone.trim() ||
      !deliveryAddress.trim()
    ) {
      setOrderError('Please enter all delivery details.')
      return
    }

    if (!/^[0-9]{10}$/.test(customerPhone.trim())) {
      setOrderError('Please enter a valid 10-digit phone number.')
      return
    }

    if (cart.length === 0 || !selectedRestaurant) {
      setOrderError('Your cart is empty.')
      return
    }

    setPlacingOrder(true)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          delivery_address: deliveryAddress.trim(),
          items: cart.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to place order')
      }

      setOrderMessage(
        `Order placed successfully! Order ID: ${data.order_id}. Total: ₹${data.total_amount}`
      )

      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setDeliveryAddress('')

    } catch (err) {
      setOrderError(err.message)
    } finally {
      setPlacingOrder(false)
    }
  }

  // Search customer order history
  async function searchOrderHistory() {
    setHistoryError('')
    setOrders([])
    setHistorySearched(false)

    const phone = historyPhone.trim()

    if (!/^[0-9]{10}$/.test(phone)) {
      setHistoryError('Please enter a valid 10-digit mobile number.')
      return
    }

    setHistoryLoading(true)

    try {
      const response = await fetch(
        `/api/orders?phone=${encodeURIComponent(phone)}`
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to retrieve orders.')
      }

      setOrders(data.orders || [])
      setHistorySearched(true)
    } catch (err) {
      setHistoryError(err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="app">

      {/* Header */}
      <header className="navbar">
        <h1>🍔 FoodExpress</h1>
        <span>🛒 Cart: {cartCount} items</span>
      </header>

      {/* Hero section */}
      <section className="hero">
        <h2>Hungry? Order your favourite food!</h2>
        <p>Discover delicious restaurants in Hyderabad.</p>
      </section>

      <main className="container">

        {selectedRestaurant ? (
          <>

            <button
              onClick={() => setSelectedRestaurant(null)}
            >
              ← Back to Restaurants
            </button>

            <h2>{selectedRestaurant.name} - Food Menu</h2>

            {menuLoading && <p>Loading food menu...</p>}
            {menuError && <p>{menuError}</p>}

            {/* Menu items */}
            <div className="restaurant-list">
              {menuItems.map(item => (
                <div className="restaurant-card" key={item.id}>

                  <div className="food-image">🍽️</div>

                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <p><strong>₹{item.price}</strong></p>
                  <p>{item.category}</p>

                  <button onClick={() => addToCart(item)}>
                    Add to Cart
                  </button>

                </div>
              ))}
            </div>

            {/* Shopping cart */}
            <section className="cart-section">

              <h2>🛒 Your Shopping Cart</h2>

              {cart.length === 0 ? (
                <p>Your cart is empty.</p>
              ) : (
                <>
                  {cart.map(item => (
                    <div className="cart-item" key={item.id}>

                      <div>
                        <strong>{item.name}</strong>
                        <p>₹{item.price} × {item.quantity}</p>
                      </div>

                      <div className="cart-actions">

                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          −
                        </button>

                        <strong>{item.quantity}</strong>

                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          +
                        </button>

                      </div>

                    </div>
                  ))}

                  <h3>Grand Total: ₹{cartTotal.toFixed(2)}</h3>

                </>
              )}

            </section>

            {/* Checkout form */}
            {cart.length > 0 && (
              <section className="checkout-section">

                <h2>📦 Checkout</h2>

                <label>Customer Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />

                <label>Mobile Number</label>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />

                <label>Delivery Address</label>
                <textarea
                  placeholder="Enter your complete delivery address"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                />

                <h3>Order Total: ₹{cartTotal.toFixed(2)}</h3>

                {orderError && (
                  <p className="error-message">{orderError}</p>
                )}

                <button
                  onClick={placeOrder}
                  disabled={placingOrder}
                >
                  {placingOrder ? 'Placing Order...' : 'Place Order'}
                </button>

              </section>
            )}

            {/* Order confirmation */}
            {orderMessage && (
              <section className="checkout-section">
                <h2>✅ Order Confirmation</h2>
                <p>{orderMessage}</p>
              </section>
            )}

          </>
        ) : (

          <>
            {/* Customer Order History */}
            <section className="checkout-section">
              <h2>📦 My Orders</h2>
              <p>Enter your mobile number to view your previous orders.</p>

              <input
                type="tel"
                placeholder="Enter 10-digit mobile number"
                value={historyPhone}
                onChange={e => setHistoryPhone(e.target.value)}
              />

              <button
                onClick={searchOrderHistory}
                disabled={historyLoading}
              >
                {historyLoading ? 'Searching...' : 'View My Orders'}
              </button>

              {historyError && (
                <p className="error-message">{historyError}</p>
              )}

              {historySearched && orders.length === 0 && (
                <p>No orders found for this mobile number.</p>
              )}

              {historySearched && orders.length > 0 && (
                <div className="order-history-list">

                  <h3>Found {orders.length} order(s)</h3>

                  {orders.map(order => (
                    <div className="restaurant-card" key={order.id}>

                      <h3>Order #{order.id}</h3>

                      <p>
                        <strong>Restaurant:</strong> {order.restaurant_name}
                      </p>

                      <p>
                        <strong>Customer:</strong> {order.customer_name}
                      </p>

                      <p>
                        <strong>Date:</strong>{' '}
                        {new Date(order.created_at).toLocaleString()}
                      </p>

                      <p>
                        <strong>Status:</strong> {order.status}
                      </p>

                      <hr />

                      <h4>Ordered Items</h4>

                      {order.items.map((item, index) => (
                        <div key={index}>
                          <p>
                            {item.item_name} × {item.quantity}
                          </p>
                          <p>
                            ₹{item.unit_price} × {item.quantity} = ₹{item.subtotal}
                          </p>
                        </div>
                      ))}

                      <hr />

                      <h3>Order Total: ₹{order.total_amount}</h3>

                    </div>
                  ))}

                </div>
              )}
            </section>

            <h2>Popular Restaurants</h2>

            {loading && <p>Loading restaurants...</p>}
            {error && <p>{error}</p>}

            <div className="restaurant-list">

              {restaurants.map(restaurant => (
                <div className="restaurant-card" key={restaurant.id}>

                  <div className="food-image">🍛</div>

                  <h3>{restaurant.name}</h3>
                  <p>📍 {restaurant.location}</p>
                  <p>⭐ {restaurant.rating}</p>

                  <button
                    onClick={() => viewRestaurant(restaurant)}
                  >
                    View Restaurant
                  </button>

                </div>
              ))}

            </div>
          </>

        )}

      </main>

      <footer>
        <p>© 2026 FoodExpress. All rights reserved.</p>
      </footer>

    </div>
  )
}

export default App
