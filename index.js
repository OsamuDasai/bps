const { Bot, Context } = require("grammy");
require("dotenv").config();
const fs = require("fs").promises;

// Configuración del cliente
const API_ID = process.env.API_ID; // Obtén esto de my.telegram.org
console.log("API_ID:", process.env.API_ID)
const API_HASH = process.env.API_HASH; // Obtén esto de my.telegram.org

// Mapeo de canales fuente a canales destino
const CHANNEL_MAPPING = {
  "-1001241912282": -1002378837530, // Canal fuente 1 -> Canal destino 1
  "-1001964649012": -1002378837530, // Canal fuente 2 -> Canal destino 2
};

// Crear instancia del cliente
const bot = new Bot({
  apiId: API_ID,
  apiHash: API_HASH,
});

// Middleware para manejar mensajes de los canales fuente
bot.on(["message:video", "message:photo"], async (ctx) => {
  try {
    const message = ctx.message;
    const chatId = String(message.chat.id); // Convertir a string para comparar con las claves del mapeo

    // Verificar si el mensaje proviene de uno de los canales fuente
    if (!CHANNEL_MAPPING[chatId]) return;

    // Descargar el archivo multimedia localmente si no se puede reenviar
    let filePath = null;
    try {
      if (message.video) {
        filePath = await ctx.getFile();
        filePath = await filePath.download({ fileName: `video_${Date.now()}.mp4` });
      } else if (message.photo) {
        filePath = await ctx.getFile();
        filePath = await filePath.download({ fileName: `photo_${Date.now()}.jpg` });
      }
    } catch (error) {
      console.error("Error al descargar el archivo:", error);
    }

    // Crear botones para el usuario
    const keyboard = {
      inline_keyboard: [
        [{ text: "Reenviar al canal destino", callback_data: "forward" }],
      ],
    };

    // Enviar el mensaje al usuario con los botones
    const caption = message.caption || "Sin descripción";
    if (filePath) {
      await ctx.replyWithVideo(
        { source: filePath },
        { caption, reply_markup: keyboard }
      );
    } else {
      await ctx.reply(caption, { reply_markup: keyboard });
    }
  } catch (error) {
    console.error("Error al procesar el mensaje:", error);
  }
});

// Manejar la acción del botón
bot.callbackQuery("forward", async (ctx) => {
  try {
    const message = ctx.callbackQuery.message;
    const chatId = String(message.chat.id); // Convertir a string para comparar con las claves del mapeo

    // Verificar si el mensaje proviene de uno de los canales fuente
    if (!CHANNEL_MAPPING[chatId]) return;

    const destinationChannel = CHANNEL_MAPPING[chatId];
    const caption = message.caption || "Sin descripción";

    // Reenviar el mensaje al canal destino correspondiente
    try {
      if (message.video) {
        await ctx.api.sendVideo(destinationChannel, message.video.file_id, {
          caption,
        });
      } else if (message.photo) {
        await ctx.api.sendPhoto(destinationChannel, message.photo[0].file_id, {
          caption,
        });
      }

      // Confirmar al usuario
      await ctx.answerCallbackQuery("Mensaje reenviado al canal destino.");
      await ctx.editMessageReplyMarkup(null); // Eliminar el botón
    } catch (error) {
      console.error("Error al reenviar el mensaje:", error);
      await ctx.answerCallbackQuery("Error al reenviar el mensaje.");
    }
  } catch (error) {
    console.error("Error al manejar el botón:", error);
  }
});

// Middleware para manejar mensajes en topics
bot.on("message", async (ctx) => {
  try {
    const message = ctx.message;

    // Verificar si el mensaje pertenece a un topic
    if (message.reply_to_message_id || message.forum_topic_created) {
      const chatId = String(message.chat.id);

      // Filtrar solo los mensajes de canales específicos
      if (!CHANNEL_MAPPING[chatId]) return;

      const destinationChannel = CHANNEL_MAPPING[chatId];
      const caption = message.caption || "Sin descripción";

      // Reenviar el mensaje al canal destino correspondiente
      try {
        if (message.video) {
          await ctx.api.sendVideo(destinationChannel, message.video.file_id, {
            caption,
          });
        } else if (message.photo) {
          await ctx.api.sendPhoto(destinationChannel, message.photo[0].file_id, {
            caption,
          });
        } else {
          await ctx.api.sendMessage(destinationChannel, message.text || "Sin texto");
        }
      } catch (error) {
        console.error("Error al reenviar el mensaje desde un topic:", error);
      }
    }
  } catch (error) {
    console.error("Error al procesar el mensaje de topic:", error);
  }
});

// Iniciar el cliente
bot.start().catch((error) => {
  console.error("Error al iniciar el cliente:", error);
});
