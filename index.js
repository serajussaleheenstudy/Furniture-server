const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 1000;
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware
app.use(cors());
app.use(express.json());

// variable
const user = process.env.DB_USER;
const password = process.env.DB_PASS;
const secret = process.env.ACCESS_TOKEN;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${user}:${password}@cluster0.nvx6pod.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  //   console.log(authHeader);
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, secret, function (err, decoded) {
    if (err) {
      // console.log(err);
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const categoriesCollection = client
      .db("sbFurniture")
      .collection("categories");
    const productsCollection = client.db("sbFurniture").collection("products");
    const usersCollection = client.db("sbFurniture").collection("users");
    const bookingsCollection = client.db("sbFurniture").collection("bookings");
    const paymentsCollection = client.db("sbFurniture").collection("payments");
      const adsCollection = client.db("sbFurniture").collection("ads");
      
       const verifyAdmin = async (req, res, next) => {
         const decodedEmail = req.decoded.email;
           const query = { email: decodedEmail };
        //    console.log(query);
           const user = await usersCollection.findOne(query);
        //    console.log(user);
         if (user?.user_type !== "Admin") {
           return res.status(403).send({ message: "forbidden access.." });
         }
         next();
       };

    //* JWT
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      //   console.log(user);
      if (user) {
        const token = jwt.sign({ email }, secret, { expiresIn: "7d" });
        return res.send({ accessToken: token });
      }
      return res.status(403).send({ accessToken: "" });
    });

    //* Users
    app.post("/users", async (req, res) => {
      const user = req.body;
      //   console.log(user);
      const filter = { email: user.email };
      const email = await usersCollection.findOne(filter);
      if (email) {
        res.send({ message: "Already have account wth this email." });
      } else {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });

    app.get("/users/status",verifyJWT,verifyAdmin, async (req, res) => {
      const type = req.query.type;
      //   console.log(email);
      const query = { user_type: type };
      const users = await usersCollection.find(query).toArray();
      //   console.log(userType);
      res.send(users);
    });
    app.get("/users/status/email", async (req, res) => {
      const email = req.query.email;

      const query = { email: email };
      const users = await usersCollection.findOne(query);
      // console.log(users);
      res.send(users);
    });

    app.get("/users/userType/:email", async (req, res) => {
      const email = req.params.email;
      //   console.log(email);
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const userType = user?.user_type;
        console.log(userType);
      res.send({ type: userType });
    });

    app.put("/status", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          seller_verified: "verified",
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.delete("/users/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      const query = { seller_email: email };
      await productsCollection.deleteMany(query);
      await adsCollection.deleteMany(query);
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    //* categories
    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoriesCollection.find(query).toArray();
      // console.log(categories);
      res.send(categories);
    });

    //* single category products
    app.get("/categories/products", async (req, res) => {
      const id = req.query.cat_id;
      const filter = { category_id: id };
      //   console.log(filter);
      const category = await categoriesCollection.findOne(filter);
      const name = category.category_name;
      const allProducts = await productsCollection.find(filter).toArray();
      const products = allProducts.filter((product) => {
        if (product.status !== "Paid") {
          return product;
        }
      });
      // console.log(products);
      res.send({ products, name });
    });

    //* single product for individual categories
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(filter);
      res.send(product);
    });

    //* all products
    app.get("/products", async (req, res) => {
      const query = {};
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });
    app.post("/product", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });
      app.put("/product/:id", async (req, res) => {
          const product = req.body;
          const id = req.params.id;
          const filter = { _id: ObjectId(id) }
          console.log(filter);
          const options = { upsert: true };
          const updatedDoc = {
            $set: {
              title: product.title,
              location: product.location,
              resale_price: product.resale_price,
              original_price: product.original_price,
              years_of_use: product.years_of_use,
              seller_phone: product.seller_phone,
              description: product.description,
            },
          };
          const result = await productsCollection.updateOne(filter, updatedDoc, options);
          console.log(result);
          res.send(result)
      })

    // * seller products
    app.get("/sellerProducts/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      //   console.log(email);
      const filter = { seller_email: email };
      const products = await productsCollection.find(filter).toArray();
      res.send(products);
    });

    app.delete("/sellerProducts/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      // console.log(filter);
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    });

    //* add advertise
    app.post("/advertiseProduct", verifyJWT, async (req, res) => {
      const product = req.body;
      //   console.log(product);
      const result = await adsCollection.insertOne(product);
      res.send(result);
    });

    app.get("/ads", async (req, res) => {
      const query = {};
      const ads = await adsCollection.find(query).toArray();
      res.send(ads);
    });

    app.get("/adsProducts/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { seller_email: email };
      const result = await adsCollection.find(filter).toArray();
      res.send(result);
    });

    app.delete("/adsDelete/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id };
      const result = await adsCollection.deleteOne(filter);
      res.send(result);
    });

    //* bookings
    app.get("/bookings/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { buyer_email: email };
      const items = await bookingsCollection.find(filter).toArray();
      res.send(items);
    });

    app.get("/bookings/myBuyers/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { seller_email: email };
      const items = await bookingsCollection.find(filter).toArray();
      res.send(items);
    });

    app.get("/bookings/paid/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = {
        buyer_email: email,
        status: "Paid",
      };
      const items = await bookingsCollection.find(filter).toArray();
      res.send(items);
    });

    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: ObjectId(id) };
      const result = await bookingsCollection.findOne(filter);
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    // * payment related
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booking = req.body;

      const price = parseInt(booking.resale_price);
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      // console.log(paymentIntent);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const productId = payment.productId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "Paid",
        },
      };

      const updatedResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      const query = { _id: productId };
      console.log(query);
      const adDelete = await adsCollection.deleteOne(query);
      // update product status
      const options = { upsert: true };
      const match = { _id: ObjectId(productId) };
      // console.log(match);
      const updateProduct = await productsCollection.updateOne(
        match,
        updatedDoc,
        options
      );
      // console.log(updateProduct);
      res.send(updatedResult);
    });

  } finally {
  }
}
run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("SB Furniture is running");
});

app.listen(port, () => {
  console.log("SB furniture running on", port);
});
