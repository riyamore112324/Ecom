import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import prisma from "@Lib/prisma";

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(userId: string, orderId: string) {
  try {
    console.log(userId, orderId);
    // Convert orderId to number
    const orderIdNumber = parseInt(orderId, 10);

    // Fetch the user data using Prisma
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }, // Ensure the email field exists in the User model
    });
    console.log(user);

    if (!user || !user.email) {
      throw new Error("User not found or email is missing.");
    }

    // Fetch the order details without including orderLine
    const order = await prisma.order.findUnique({
      where: { id: orderIdNumber },
      select: {
        total: true, // Include other fields as needed
        additionalInfo: true,
        date: true,
      },
    });

    if (!order) {
      throw new Error("Order not found.");
    }

    // Construct the email body with order details
    const emailBody = `
      We appreciate your business! Here are your order details:
      
      Order ID: ${orderIdNumber}
      Total: $${order.total.toFixed(2)}
      Date: ${new Date(order.date).toLocaleDateString()}
      Additional Info: ${order.additionalInfo || 'N/A'}
      
      If you have any questions, please contact us at orders@jones.com.
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender address
      to: user.email, // List of receivers
      subject: "Thanks for your order!", // Subject line
      text: emailBody, // Plain text body
    };

    // Send email
    console.log(mailOptions);
    const mail = await transporter.sendMail(mailOptions);
    console.log(mail);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { userId, orderId } = req.body;
    if (userId && orderId) {
      await sendEmail(userId, orderId);
      res.status(200).json({ message: "Email sent successfully." });
    } else {
      res.status(400).json({ message: "User ID and Order ID are required." });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
