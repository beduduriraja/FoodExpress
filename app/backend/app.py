
import os
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, jsonify, request
from decimal import Decimal

app = Flask(__name__)


def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        database=os.environ.get("DB_NAME", "foodexpress"),
        user=os.environ.get("DB_USER", "fooduser"),
        password=os.environ["FOOD_DB_PASSWORD"],
        port=os.environ.get("DB_PORT", "5432")
    )


@app.route("/")
def home():
    return jsonify({"message": "Welcome to FoodExpress API!"})


@app.route("/health")
def health():
    return jsonify({
        "status": "UP",
        "application": "FoodExpress"
    })


@app.route("/api/restaurants")
def get_restaurants():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, name, location, cuisine, rating
            FROM restaurants
            ORDER BY id
        """)

        restaurants = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify(restaurants)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/restaurants/<int:restaurant_id>/menu")
def get_restaurant_menu(restaurant_id):
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, restaurant_id, name, description,
                   price, category, is_available
            FROM menu_items
            WHERE restaurant_id = %s
              AND is_available = TRUE
            ORDER BY id
        """, (restaurant_id,))

        menu_items = cur.fetchall()
        return jsonify(menu_items)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route("/api/orders", methods=["POST"])
def place_order():
    conn = None
    cur = None

    try:
        data = request.get_json()

        restaurant_id = data.get("restaurant_id")
        customer_name = data.get("customer_name")
        customer_phone = data.get("customer_phone")
        delivery_address = data.get("delivery_address")
        items = data.get("items")

        if not all([restaurant_id, customer_name,
                    customer_phone, delivery_address, items]):
            return jsonify({"error": "All fields are required"}), 400

        if not isinstance(items, list):
            return jsonify({"error": "Items must be a list"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        total_amount = Decimal("0.00")
        order_details = []

        for item in items:
            menu_item_id = item.get("menu_item_id")
            quantity = item.get("quantity")

            if (not isinstance(menu_item_id, int)
                    or not isinstance(quantity, int)
                    or quantity <= 0):
                raise ValueError("Invalid menu item or quantity")

            cur.execute("""
                SELECT id, name, price
                FROM menu_items
                WHERE id = %s
                  AND restaurant_id = %s
                  AND is_available = TRUE
            """, (menu_item_id, restaurant_id))

            food = cur.fetchone()

            if not food:
                raise ValueError("Food item is unavailable")

            subtotal = food["price"] * quantity
            total_amount += subtotal

            order_details.append({
                "menu_item_id": food["id"],
                "item_name": food["name"],
                "quantity": quantity,
                "unit_price": food["price"],
                "subtotal": subtotal
            })

        cur.execute("""
            INSERT INTO orders
            (restaurant_id, customer_name, customer_phone,
             delivery_address, total_amount)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            restaurant_id,
            customer_name,
            customer_phone,
            delivery_address,
            total_amount
        ))

        order_id = cur.fetchone()["id"]

        for item in order_details:
            cur.execute("""
                INSERT INTO order_items
                (order_id, menu_item_id, item_name,
                 quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                order_id,
                item["menu_item_id"],
                item["item_name"],
                item["quantity"],
                item["unit_price"],
                item["subtotal"]
            ))

        conn.commit()

        return jsonify({
            "message": "Order placed successfully",
            "order_id": order_id,
            "total_amount": str(total_amount),
            "status": "PLACED"
        }), 201

    except ValueError as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route("/api/orders", methods=["GET"])
def get_order_history():
    conn = None
    cur = None

    try:
        phone = request.args.get("phone", "").strip()

        if not phone:
            return jsonify({"error": "Phone number is required"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT
                o.id,
                o.restaurant_id,
                r.name AS restaurant_name,
                o.customer_name,
                o.total_amount::text AS total_amount,
                o.status,
                o.created_at
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.customer_phone = %s
            ORDER BY o.created_at DESC
            LIMIT 50
        """, (phone,))

        orders = cur.fetchall()

        for order in orders:
            cur.execute("""
                SELECT
                    item_name,
                    quantity,
                    unit_price::text AS unit_price,
                    subtotal::text AS subtotal
                FROM order_items
                WHERE order_id = %s
                ORDER BY id
            """, (order["id"],))

            order["items"] = cur.fetchall()

        return jsonify({"orders": orders}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()



@app.route("/api/restaurant/orders", methods=["GET"])
def get_all_restaurant_orders():
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT
                o.id,
                o.restaurant_id,
                r.name AS restaurant_name,
                o.customer_name,
                o.customer_phone,
                o.delivery_address,
                o.total_amount::text AS total_amount,
                o.status,
                o.created_at
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            ORDER BY o.created_at DESC
            LIMIT 100
        """)

        orders = cur.fetchall()

        for order in orders:
            cur.execute("""
                SELECT
                    item_name,
                    quantity,
                    unit_price::text AS unit_price,
                    subtotal::text AS subtotal
                FROM order_items
                WHERE order_id = %s
                ORDER BY id
            """, (order["id"],))

            order["items"] = cur.fetchall()

        return jsonify({"orders": orders}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()



@app.route("/api/orders/<int:order_id>/status", methods=["PUT"])
def update_order_status(order_id):
    conn = None
    cur = None

    valid_statuses = [
        "PLACED",
        "PREPARING",
        "READY",
        "DELIVERED",
        "CANCELLED"
    ]

    try:
        data = request.get_json(silent=True) or {}
        new_status = data.get("status", "").strip().upper()

        if new_status not in valid_statuses:
            return jsonify({
                "error": "Invalid status",
                "valid_statuses": valid_statuses
            }), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            UPDATE orders
            SET status = %s
            WHERE id = %s
            RETURNING id, status
        """, (new_status, order_id))

        updated_order = cur.fetchone()

        if not updated_order:
            conn.rollback()
            return jsonify({"error": "Order not found"}), 404

        conn.commit()

        return jsonify({
            "message": "Order status updated successfully",
            "order_id": updated_order["id"],
            "status": updated_order["status"]
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

