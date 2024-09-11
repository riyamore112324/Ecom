import type { NextApiRequest, NextApiResponse, } from "next";
import type { DefaultResponse } from "src/types/shared";

import Stripe from "stripe";
import { OrderStatus } from "@prisma/client";
import { buffer } from "micro";

import RouteHandler from "@Lib/RouteHandler";
import prisma from "@Lib/prisma";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2022-08-01",
  typescript: true,
});

const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

// Set up Nodemailer transporter


async function ConfirmPayment(
  req: NextApiRequest,
  res: NextApiResponse<DefaultResponse>
) {
  const sig = req.headers["stripe-signature"];
  const reqBuffer = await buffer(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      reqBuffer,
      sig ?? "",
      endpointSecret ?? ""
    );
  } catch (err) {
    if (err instanceof Error)
      res
        .status(400)
        .json({ error: true, message: `Webhook Error: ${err.message}` });
    return;
  }

  if (event.type == "checkout.session.completed") {
    const session = event.data.object;
    console.log(session)
    // @ts-ignore
    const { orderId, userId } = session.metadata;
    const { payment_status } = session as any;

  if (payment_status == "paid") {
    try {
      await prisma.order.update({
        where: { id: Number(orderId) },
        data: { status: OrderStatus.PAYMENT_RECEIVED },
      });

      const cart = await prisma.cart.findUnique({
        where: { userId: userId },
      });

      if (!cart) {
        return res.status(400).json({ success: false, message: "Cart not found" });
      }

      const orderLineItems = await prisma.orderLine.findMany({
        where: { orderId: Number(orderId) },
      });

      for await (const item of orderLineItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            salesCount: { increment: 1 },
            stockQty: { decrement: item.quantity },
          },
        });
        await prisma.cartItem.delete({
          where: {
            cartId_productId: { cartId: cart.id, productId: item.productId },
          },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      });
      console.log(user);
      const message = "Thank you for purchasing your product.You will receive further updates soon"
      const emailHtml = `
  <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <header style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #ddd;">
          <h2 style="color: #4CAF50;">Hello, ${user?.firstName}!</h2>
        </header>
        <section>
          <p>Thank you for reaching out to us. We have received your message and will get back to you shortly.</p>
          <p>If you have any further questions, feel free to reply to this email or contact our support team.</p>
        </section>
        <footer style="margin-top: 20px; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; font-size: 12px; color: #777;">
          <p>&copy; 2024 Your Company. All rights reserved.</p>
          <p>
            <a href="https://www.yourcompany.com" style="color: #4CAF50; text-decoration: none;">Visit our website</a> |
            <a href="https://www.yourcompany.com/unsubscribe" style="color: #4CAF50; text-decoration: none;">Unsubscribe</a>
          </p>
        </footer>
      </div>
    </body>
  </html>
`;

      if (user) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          host: 'smtp.gmail.com',
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        })
        try {
          await transporter.sendMail({
            from:process.env.EMAIL_USER , // sender address
            to:user.email , // list of receivers
            subject: `Message from ${process.env.EMAIL_USER} `, // Subject line
            text: JSON.stringify(message), // plain text body
            html: emailHtml // html body
          })
          return res.json({ success: true,message: message})
        } catch (err) {
          console.log(err)
          return res.json({ success: false, message:"Error" })
        }
      }
      console.log('Email sent successfully');

      return res.json({ success: true, message: "Payment confirmed and email sent" });
    } catch (e) {
      console.error('Error processing payment:', e);
      return res.status(500).json({ success: false, message: "Error processing payment" });
    }
  }
}


  res.status(400).json({ success: false, message: "Unhandled event type" });
}

export default RouteHandler().post(ConfirmPayment);
