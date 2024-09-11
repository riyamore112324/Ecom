import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

type PaymentSuccessProps = {
  userId?: string;
  orderId?: string;
};

function PaymentSuccess({ userId, orderId }: PaymentSuccessProps) {
  const router = useRouter();

  useEffect(() => {
    if (userId && orderId) {
      fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, orderId }),
      })
      .then(response => response.json())
      .then(data => {
        console.log("Email sent successfully:", data);
      })
      .catch(error => {
        console.error("Error sending email:", error);
      });
    }
  }, [userId, orderId]);

  return (
    <div className="page">
      <div className="page__container">
        <Head>
          <title>Thanks for your order!</title>
        </Head>
        <h1 className="main-heading">Payment Received</h1>
        <section>
          <p>
            We appreciate your business! If you have any questions, please email{" "}
            <a href="mailto:orders@jones.com">orders@jones.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}

// Fetch userId and orderId from query parameters
export async function getServerSideProps(context: any) {
  const { userId, orderId } = context.query;
  return {
    props: { userId: userId || null, orderId: orderId || null }, // Provide default value if userId or orderId is not found
  };
}

export default PaymentSuccess;
