import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Alert, Table } from 'react-bootstrap';
import {
  customerService,
  extractCustomerErrorMessage,
} from '../../services/customerService';
import CustomerAddressFormModal from './CustomerAddressFormModal';
import { Customer, CustomerAddress } from '../../types/customer';

type CustomerAddressesSectionProps = {
  customer: Customer | null;
  onHide: () => void;
};

const CustomerAddressesSection: React.FC<CustomerAddressesSectionProps> = ({
  customer,
  onHide,
}) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [toEditAddress, setToEditAddress] = useState<CustomerAddress | null>(null);

  const [toDeleteAddress, setToDeleteAddress] = useState<CustomerAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const [deleteAddressError, setDeleteAddressError] = useState('');

  const fetchAddresses = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    setError('');
    try {
      const res = await customerService.listAddresses(customer.id);
      setAddresses(res.data);
    } catch {
      setError('Unable to load addresses. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    if (customer) {
      void fetchAddresses();
    } else {
      setAddresses([]);
      setError('');
    }
  }, [customer, fetchAddresses]);

  const handleDeleteAddress = async () => {
    if (!customer || !toDeleteAddress) return;
    setDeletingAddress(true);
    setDeleteAddressError('');
    try {
      await customerService.deleteAddress(customer.id, toDeleteAddress.id);
      setToDeleteAddress(null);
      void fetchAddresses();
    } catch (err) {
      setDeleteAddressError(extractCustomerErrorMessage(err));
    } finally {
      setDeletingAddress(false);
    }
  };

  const handleHide = () => {
    setShowAdd(false);
    setToEditAddress(null);
    setToDeleteAddress(null);
    setDeleteAddressError('');
    onHide();
  };

  return (
    <>
      <Modal
        show={customer !== null}
        onHide={handleHide}
        size="lg"
        fullscreen="sm-down"
        data-testid="modal-customer-addresses"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Addresses — {customer?.firstName} {customer?.lastName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {!loading && !error && addresses.length === 0 && (
            <Alert variant="info" data-testid="addresses-empty-state">
              No addresses on file.
            </Alert>
          )}
          {!loading && !error && addresses.length > 0 && (
            <Table hover size="sm" data-testid="addresses-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Full Name</th>
                  <th>Street</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {addresses.map((a) => (
                  <tr key={a.id} data-testid={`address-row-${a.id}`}>
                    <td>{a.type}</td>
                    <td>{a.fullName}</td>
                    <td>
                      {a.streetLine1}
                      {a.streetLine2 ? `, ${a.streetLine2}` : ''}
                    </td>
                    <td>{a.city}</td>
                    <td>{a.country}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        onClick={() => setToEditAddress(a)}
                        data-testid={`btn-edit-address-${a.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setToDeleteAddress(a)}
                        data-testid={`btn-delete-address-${a.id}`}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => setShowAdd(true)}
            data-testid="btn-add-address"
          >
            Add address
          </Button>
          <Button variant="secondary" onClick={handleHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {customer && (
        <CustomerAddressFormModal
          show={showAdd}
          onHide={() => setShowAdd(false)}
          customerId={customer.id}
          onSuccess={() => {
            setShowAdd(false);
            void fetchAddresses();
          }}
        />
      )}

      {customer && (
        <CustomerAddressFormModal
          show={toEditAddress !== null}
          onHide={() => setToEditAddress(null)}
          customerId={customer.id}
          initial={toEditAddress ?? undefined}
          onSuccess={() => {
            setToEditAddress(null);
            void fetchAddresses();
          }}
        />
      )}

      <Modal
        show={toDeleteAddress !== null}
        onHide={() => { setToDeleteAddress(null); setDeleteAddressError(''); }}
        fullscreen="sm-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>Delete address</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteAddressError && <Alert variant="danger">{deleteAddressError}</Alert>}
          {!deleteAddressError && (
            <>Are you sure you want to delete this address? This action cannot be undone.</>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => { setToDeleteAddress(null); setDeleteAddressError(''); }}
          >
            Cancel
          </Button>
          {!deleteAddressError && (
            <Button
              variant="danger"
              disabled={deletingAddress}
              onClick={handleDeleteAddress}
              data-testid="btn-confirm-delete-address"
            >
              {deletingAddress ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CustomerAddressesSection;
