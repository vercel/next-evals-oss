import Image from 'next/image'

export default function ProductGallery() {
  const products = [
    { id: 1, name: 'Product 1', imageUrl: '/product-1.jpg' },
    { id: 2, name: 'Product 2', imageUrl: '/product-2.jpg' },
    { id: 3, name: 'Product 3', imageUrl: '/product-3.jpg' },
  ]

  return (
    <div>
      <h3>Product Gallery</h3>
      <div>
        {products.map((product) => (
          <div key={product.id}>
            <h4>{product.name}</h4>
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={300}
              height={200}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
