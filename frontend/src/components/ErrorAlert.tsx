import React, { useState } from 'react';
import { Alert } from 'react-bootstrap';

type ErrorAlertProps = {
  message: string;
};

const ErrorAlert: React.FC<ErrorAlertProps> = ({ message }) => {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <Alert variant="danger" dismissible onClose={() => setShow(false)}>
      {message}
    </Alert>
  );
};

export default ErrorAlert;
