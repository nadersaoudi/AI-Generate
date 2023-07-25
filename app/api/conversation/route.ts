import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export async function POST(req:Request) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { messages } = body;

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!configuration.apiKey) {
      return new NextResponse("OpenAI API Key not configured.", {
        status: 500,
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return new NextResponse("Messages must be an array.", { status: 400 });
    }

    let retryCount = 0;
    const maxRetries = 3;
    const initialDelay = 500; // 1 second

    const makeOpenAIRequestWithRetry = async () => {
      try {
        const response = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages,
        });
        return new NextResponse(JSON.stringify(response.data.choices[0].message));
      } catch (error) {
        if (error.response && error.response.status === 429 && retryCount < maxRetries) {
          retryCount++;
          const backoffDelay = initialDelay * 2 ** retryCount;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          return makeOpenAIRequestWithRetry();
        } else {
          throw error;
        }
      }
    };

    return await makeOpenAIRequestWithRetry();
  } catch (error) {
    return new NextResponse(JSON.stringify(error), { status: 500 });
  }
}