import React from 'react';
import { getUploadUrl } from '../../api/axios';

export default function ProductCard({ p }) {
  const image = (p.images && p.images[0]) || p.image;
  return (
    <div className="product-card">
      {image && <img className="product-card-image" src={getUploadUrl(image)} alt={p.title} />}
      <h4>{p.title}</h4>
      <p>{p.description}</p>
      <div className="price">{p.price}</div>
    </div>
  );
}
