import React, { useEffect, useState } from 'react';
import { Alert, Button, Container, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { listWishlist, removeFromWishlist } from '../../services/wishlistService';
import PriceTag from '../../components/storefront/PriceTag';

interface WishlistItem {
  id: number;
  productVariantId: number;
  variant: {
    publicPrice: string;
    product: { name: string; id: number };
  };
}

const AccountWishlistPage: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    listWishlist()
      .then((data) => setItems(data as WishlistItem[]))
      .catch(() => setError('Could not load wishlist.'));
  };

  useEffect(() => { load(); }, []);

  const handleRemove = async (productVariantId: number) => {
    await removeFromWishlist(productVariantId);
    load();
  };

  return (
    <Container className="py-4">
      <p className="mb-3"><Link to="/account">← My account</Link></p>
      <h1 className="h4 mb-3">Wishlist</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      {!items.length ? (
        <p>Your wishlist is empty.</p>
      ) : (
        <ListGroup>
          {items.map((item) => (
            <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center">
              <div>
                <Link to={`/catalog/${item.variant.product.id}`}>{item.variant.product.name}</Link>
                <div><PriceTag publicPrice={parseFloat(item.variant.publicPrice)} /></div>
              </div>
              <Button variant="outline-danger" size="sm" onClick={() => handleRemove(item.productVariantId)}>
                Remove
              </Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Container>
  );
};

export default AccountWishlistPage;
