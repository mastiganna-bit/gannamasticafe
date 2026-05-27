const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const imagesDir = path.join(publicDir, 'images');

// Directory list
const directories = [
  imagesDir,
  path.join(imagesDir, 'cane'),
  path.join(imagesDir, 'beverages'),
  path.join(imagesDir, 'milkshakes'),
  path.join(imagesDir, 'burgers'),
  path.join(imagesDir, 'sandwiches'),
  path.join(imagesDir, 'pizza'),
  path.join(imagesDir, 'about')
];

// Helper to ensure directories exist
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Function to generate a premium SVG mockup
function getSvg(title, bgStart, bgEnd, iconText) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
    <defs>
      <linearGradient id="g_${title.replace(/\s+/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#4A3728" flood-opacity="0.15" />
      </filter>
    </defs>
    <rect width="400" height="300" fill="url(#g_${title.replace(/\s+/g, '')})" />
    
    <!-- Pattern overlay -->
    <g opacity="0.06">
      <circle cx="20" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="60" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="100" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="140" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="180" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="220" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="260" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="300" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="340" cy="20" r="2" fill="#FAF7F2" />
      <circle cx="380" cy="20" r="2" fill="#FAF7F2" />
      
      <circle cx="40" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="80" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="120" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="160" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="200" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="240" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="280" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="320" cy="60" r="2" fill="#FAF7F2" />
      <circle cx="360" cy="60" r="2" fill="#FAF7F2" />
    </g>

    <!-- Logo / Illustration Graphic -->
    <g transform="translate(200, 130)" filter="url(#shadow)">
      <circle cx="0" cy="0" r="45" fill="#FAF7F2" />
      <text x="0" y="12" font-family="'Georgia', serif" font-size="36" text-anchor="middle" fill="#3D6B4F">${iconText}</text>
    </g>

    <!-- Card Brand Text -->
    <text x="200" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" text-anchor="middle" fill="#FAF7F2" letter-spacing="1">${title.toUpperCase()}</text>
    <text x="200" y="245" font-family="system-ui, -apple-system, sans-serif" font-size="11" opacity="0.8" text-anchor="middle" fill="#FAF7F2" letter-spacing="0.5">GANNAMASTI CAFE</text>
  </svg>`;
}

// Logo SVG (needs to be transparent background)
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="46" fill="#3D6B4F" />
  <circle cx="50" cy="50" r="40" fill="none" stroke="#FAF7F2" stroke-width="2" />
  <text x="50" y="60" font-family="'Georgia', serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#FAF7F2">🍹</text>
</svg>`;

const assets = [
  // Core
  { path: 'logo.png', content: logoSvg },
  { path: 'hero-juice.jpg', content: getSvg('Fresh Sugarcane Juice', '#3D6B4F', '#7A9E7E', '🍹') },
  { path: 'hero-bg.jpg', content: getSvg('Gannamasti Background', '#FAF7F2', '#E8E0D5', '✨') },

  // Cane Juice
  { path: 'cane/ganna-regular.jpg', content: getSvg('Regular Ganna', '#3D6B4F', '#7A9E7E', '🥤') },
  { path: 'cane/ganna-medium.jpg', content: getSvg('Medium Ganna', '#2D5040', '#3D6B4F', '🥤') },
  { path: 'cane/ganna-large.jpg', content: getSvg('Large Ganna', '#1E382A', '#2D5040', '🥤') },
  { path: 'cane/ganna-xl.jpg', content: getSvg('XL Ganna', '#2D5040', '#7A9E7E', '🥤') },
  { path: 'cane/ganna-jumbo.jpg', content: getSvg('Jumbo Ganna', '#3D6B4F', '#A3C6A8', '🥤') },

  // Beverages
  { path: 'beverages/lemon-masala-soda.jpg', content: getSvg('Lemon Masala Soda', '#C17B2F', '#D4944A', '🍋') },
  { path: 'beverages/green-mint-mojito.jpg', content: getSvg('Green Mint Mojito', '#3D6B4F', '#7A9E7E', '🌱') },
  { path: 'beverages/watermelon-mojito.jpg', content: getSvg('Watermelon Mojito', '#C94A4A', '#E07B7B', '🍉') },
  { path: 'beverages/blue-lagoon-mojito.jpg', content: getSvg('Blue Lagoon Mojito', '#2F6BC1', '#5B94E3', '🌀') },
  { path: 'beverages/cold-coffee.jpg', content: getSvg('Cold Coffee', '#4A3728', '#6B5344', '🧋') },
  { path: 'beverages/hot-coffee.jpg', content: getSvg('Hot Coffee', '#332418', '#4A3728', '☕') },
  { path: 'beverages/classic-chai.jpg', content: getSvg('Classic Chai', '#6B5344', '#C17B2F', '🍵') },
  { path: 'beverages/masala-chai.jpg', content: getSvg('Masala Chai', '#4A3728', '#C17B2F', '🍵') },

  // Milkshakes
  { path: 'milkshakes/banana-milkshake.jpg', content: getSvg('Banana Milkshake', '#E3C15B', '#F5E19D', '🍌') },
  { path: 'milkshakes/mango-milkshake.jpg', content: getSvg('Mango Milkshake', '#C17B2F', '#E3A35B', '🥭') },
  { path: 'milkshakes/vanilla-milkshake.jpg', content: getSvg('Vanilla Milkshake', '#E8E0D5', '#FAF7F2', '🍦') },
  { path: 'milkshakes/strawberry-milkshake.jpg', content: getSvg('Strawberry Milkshake', '#C94A8B', '#E37BB2', '🍓') },
  { path: 'milkshakes/blackcurrant-milkshake.jpg', content: getSvg('Blackcurrant Milkshake', '#5B2FC1', '#855BE3', '🍇') },
  { path: 'milkshakes/butterscotch-milkshake.jpg', content: getSvg('Butterscotch Milkshake', '#C17B2F', '#D4944A', '🍬') },
  { path: 'milkshakes/chocolate-milkshake.jpg', content: getSvg('Chocolate Milkshake', '#332418', '#6B5344', '🍫') },
  { path: 'milkshakes/oreo-milkshake.jpg', content: getSvg('Oreo Milkshake', '#1A110B', '#332418', '🍪') },
  { path: 'milkshakes/hazelnut-milkshake.jpg', content: getSvg('Hazelnut Milkshake', '#4A3728', '#9B8577', '🌰') },

  // Burgers
  { path: 'burgers/classic-veggie-burger.jpg', content: getSvg('Classic Veggie Burger', '#C17B2F', '#6B5344', '🍔') },
  { path: 'burgers/double-patty-burger.jpg', content: getSvg('Double Patty Burger', '#4A3728', '#332418', '🍔') },
  { path: 'burgers/paneer-veggie-burger.jpg', content: getSvg('Paneer Veggie Burger', '#E3A35B', '#6B5344', '🍔') },
  { path: 'burgers/tandoori-veggie-burger.jpg', content: getSvg('Tandoori Burger', '#C94A4A', '#4A3728', '🍔') },
  { path: 'burgers/melted-cheese-burger.jpg', content: getSvg('Melted Cheese Burger', '#E3C15B', '#C17B2F', '🍔') },
  { path: 'burgers/deluxe-burger.jpg', content: getSvg('Deluxe Burger', '#3D6B4F', '#C17B2F', '🍔') },

  // Sandwiches
  { path: 'sandwiches/gannamasti-spl-sandwich.jpg', content: getSvg('Special Sandwich', '#3D6B4F', '#E3A35B', '🥪') },

  // Pizzas
  { path: 'pizza/mix-veggie-pizza.jpg', content: getSvg('Mix Veggie Pizza', '#C17B2F', '#C94A4A', '🍕') },
  { path: 'pizza/margarita-pizza.jpg', content: getSvg('Margarita Pizza', '#C94A4A', '#E3C15B', '🍕') },
  { path: 'pizza/paneer-veggie-pizza.jpg', content: getSvg('Paneer Veggie Pizza', '#E3A35B', '#C94A4A', '🍕') },
  { path: 'pizza/tandoori-paneer-pizza.jpg', content: getSvg('Tandoori Paneer Pizza', '#C94A4A', '#6B5344', '🍕') },
  { path: 'pizza/cheese-burst-pizza.jpg', content: getSvg('Cheese Burst Pizza', '#E3C15B', '#FAF7F2', '🍕') },
  { path: 'pizza/fully-loaded-pizza.jpg', content: getSvg('Fully Loaded Pizza', '#3D6B4F', '#C94A4A', '🍕') },
  { path: 'pizza/gannamasti-spl-pizza.jpg', content: getSvg('Special Pizza', '#3D6B4F', '#C17B2F', '🍕') },
  { path: 'pizza/onion-pizza.jpg', content: getSvg('Onion Pizza', '#A86BB9', '#C17B2F', '🍕') },
  { path: 'pizza/tomato-pizza.jpg', content: getSvg('Tomato Pizza', '#C94A4A', '#C17B2F', '🍕') },
  { path: 'pizza/capsicum-pizza.jpg', content: getSvg('Capsicum Pizza', '#3D6B4F', '#C17B2F', '🍕') },
  { path: 'pizza/sweet-corn-pizza.jpg', content: getSvg('Sweet Corn Pizza', '#E3C15B', '#C17B2F', '🍕') },
  { path: 'pizza/paneer-pizza.jpg', content: getSvg('Paneer Pizza', '#E3A35B', '#C17B2F', '🍕') },
  { path: 'pizza/onion-sweetcorn-pizza.jpg', content: getSvg('Onion & Sweet Corn', '#A86BB9', '#E3C15B', '🍕') },
  { path: 'pizza/onion-capsicum-pizza.jpg', content: getSvg('Onion & Capsicum', '#A86BB9', '#3D6B4F', '🍕') },
  { path: 'pizza/onion-tomato-pizza.jpg', content: getSvg('Onion & Tomato', '#A86BB9', '#C94A4A', '🍕') },
  { path: 'pizza/tomato-sweetcorn-pizza.jpg', content: getSvg('Tomato & Sweet Corn', '#C94A4A', '#E3C15B', '🍕') },
  { path: 'pizza/capsicum-sweetcorn-pizza.jpg', content: getSvg('Capsicum & Sweet Corn', '#3D6B4F', '#E3C15B', '🍕') },
  { path: 'pizza/single-bread-pizza.jpg', content: getSvg('Single Bread Pizza', '#C17B2F', '#E8E0D5', '🍞') },
  { path: 'pizza/tandoori-bread-pizza.jpg', content: getSvg('Tandoori Bread Pizza', '#C94A4A', '#E8E0D5', '🍞') },
  { path: 'pizza/double-deck-bread-pizza.jpg', content: getSvg('Double Deck Pizza', '#4A3728', '#E8E0D5', '🍞') },
  { path: 'pizza/sandwich-pizza.jpg', content: getSvg('Sandwich Pizza', '#3D6B4F', '#E8E0D5', '🥪') },
  { path: 'pizza/cheese-garlic-bread.jpg', content: getSvg('Cheese Garlic Bread', '#E3C15B', '#FAF7F2', '🧄') },

  // Story
  { path: 'about/cafe-story.jpg', content: getSvg('Our Cafe Story', '#3D6B4F', '#4A3728', '✨') }
];

console.log('Generating premium vector mock assets...');
assets.forEach(asset => {
  const filePath = path.join(imagesDir, asset.path);
  fs.writeFileSync(filePath, asset.content, 'utf8');
});
console.log('Successfully generated all mock assets in public/images/! 🎉');
