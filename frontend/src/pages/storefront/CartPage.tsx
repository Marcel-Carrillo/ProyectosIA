import React from 'react';
import { Button, Container, Table } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import PriceTag from '../../components/storefront/PriceTag';

const CartPage: React.FC = () => {
  const { items, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  const subtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.publicPrice) * item.quantity,
    0
  );

  if (!items.length) {
    return (
      <Container className="py-4">
        <h1 className="h4">Your cart is empty</h1>
        <Link to="/catalog">Continue shopping</Link>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="h4 mb-3">Cart</h1>
      <Table responsive>
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.productVariantId}>
              <td>
                <div>{item.productName}</div>
                <small className="text-muted">{[item.size, item.color].filter(Boolean).join(' · ')}</small>
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.productVariantId, parseInt(e.target.value, 10) || 1)}
                  style={{ width: 64 }}
                />
              </td>
              <td><PriceTag publicPrice={parseFloat(item.publicPrice) * item.quantity} /></td>
              <td>
                <Button variant="link" size="sm" onClick={() => removeItem(item.productVariantId)}>Remove</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="d-flex justify-content-between align-items-center">
        <strong>Subtotal: <PriceTag publicPrice={subtotal} /></strong>
        <Button onClick={() => navigate('/checkout')}>Checkout</Button>
      </div>
    </Container>
  );
};

export default CartPage;
