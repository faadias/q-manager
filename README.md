# q-manager

Implementação simples de um servidor acoplado ao RabbitMQ para gerenciamento de dados em filas utilizando o modelo de roteamento [Direct Exchange](https://www.rabbitmq.com/tutorials/amqp-concepts.html#exchange-direct). A ideia por trás deste projeto é que ele seja algo desacoplado do servidor central (de negócio), ficando responsável apenas pelo gerenciamento de filas. Deste modo, o Q-Manager tem pouca ou quase nenhuma lógica de negócio; seu trabalho é ter endpoints para receber dados e colocá-los nas filas necessárias, bem como permitir a criação de consumidores que leem das filas e enviam esses dados para o servidor de negócios para serem de fato processados.

## Rodando o projeto

1. Clone o projeto;
2. Crie um arquivo `.env` no diretório raiz do projeto (utilize como modelo o arquivo `.env.example`);
3. Instale as dependências (`npm install`);
4. Inicialize a instância local do RabbitMQ via Docker através do comando `npm run docker:up`;
5. Aguarde alguns segundos após a instância do RabbitMQ subir (para evitar que ela não esteja totalmente pronta a receber conexões) e inicialize o servidor **em modo de teste** com o comando `npm run start:test`.

Para um exemplo rápido, faça um POST para a rota `/test` colocando os dados da "mensagem" no corpo (body) da requisição (um json ou uma string, por exemplo). Isso fará com que ela seja colocada em uma fila. Assim que o item da fila for processado, o console apresentará um texto dizendo que a mensagem foi consumida, junto de um hash MD5 calculado sobre os dados enviados no corpo da requisição.

**_Observações:_**

- Para desligar o servidor, aperte Ctrl+C no terminal onde ele foi inicializado.
- Para finalizar a instância do RabbitMQ no Docker, utilize o comando `npm run docker:down`.
- As configurações da instância do RabbitMQ no Docker (como host, porta, usuário e senha) encontram-se definidas no arquivo `docker-compose.yml`. Obs.: uma interface web é criada para acompanhar as filas e é acessível através da url http://localhost:15672;
- O servidor se conecta ao RabbitMQ utilizando as definições das variáveis de ambiente prefixadas por **QUEUE\_** constantes do arquivo `.env`. Ou seja, para se conectar a uma instância remota, ao invés da versão Docker local, basta alterar os valores das variáveis de ambiente.
- Como não foi especificado volume físico para a instância do RabbitMQ no `docker-compose.yml`, as filas deixam de existir sempre que sua instância é desligada.

## Criando Produtores e Consumidores

1. Crie um Consumer de dados na pasta `src/consumer`. Obs.: são os Consumers que definem as filas que precisam ser criadas no RabbitMQ caso não existam. Logo, é preciso haver um Consumer para a fila correspondente ser criada e um Producer poder colocar dados nela. Todo Consumer precisa implementar a interface `IConsumer` e especificar seu nome, o nome da fila de onde consumirá os dados e um método responsável por processar as mensagens que irá receber. Exemplo:

```typescript
export class DummyConsumer implements IConsumer {
  readonly queue = "nome-da-fila";
  readonly name = "nome-do-consumer";
  consume(message: Message): void {
    console.info(`Consume message ID ${message.id} with data ${message.data}`);
  }
}
```

2. Crie um novo Controller (url para envio de dados) na pasta `src/controllers`. Obs.: o projeto utiliza a biblioteca [OvernightJS](https://www.npmjs.com/package/@overnightjs/core) para a criação de Controllers;
3. O Controller recebe a requisição feita a ele dentro de um objeto `Request`. Ele contém um atributo chamado `publisher`, que pode ser utilizado para especificar um nome de fila e colocar nela uma `Message` (composta de um `id` do tipo string e um campo `data`). Exemplo de Controller que recebe um POST e coloca os dados recebidos no corpo da requisição na fila `nome-da-fila`:

```typescript
@Controller("foo")
export class FooController {
  @Post()
  async post(req: Request, res: Response) {
    await req.publisher.publish("nome-da-fila", {
      id: "id-gerado",
      data: req.body
    });
    res.status(201).send();
  }
}
```

4. Agora é só iniciar o servidor em modo de desenvolvimento (`npm run start:dev`) e fazer um POST para `/foo` com os dados a serem colocados na fila contidos no corpo da requisição. O Consumer será executado tão logo haja mensagens na fila.

> **Atenção!** Tenha certeza de que o nome da fila onde a mensagem está sendo publicada é **igual** ao nome da fila especificada no Consumer.

**_Observação:_** Para Producers mais simples, foi criada uma classe abstrata chamada `BaseRawDataProducerController` contendo um método utilitário `publish`, que já faz a tratativa de gerar um ID único (UUID v4), coloca a mensagem na fila e retornar uma resposta (201 em caso de sucesso; 404 se a fila não existir; ou 500 em caso de erro desconhecido).

## Scripts de execução do servidor

- `npm run start` compila os arquivos numa pasta `dist` na raiz do projeto e roda o servidor a partir de lá. O número de processos rodando (workers) será igual ao definido pela variável de ambiente `WORKERS` no arquivo `.env` (mínimo: 1 / máximo: 10 / default: nº CPUs). _Obs.:_ o ambiente de execução será definido pelo valor da variável `NODE_ENV` no arquivo `.env`;
- `npm run start:dev` inicializa o servidor em modo `development` utilizando o `ts-node-dev`, o qual automaticamente reinicializa o servidor sempre que um arquivo é alterado, facilitando testes durante o desenvolvimento; este modo também permite rodar o comando `npm run climem` em outro terminal para poder acompanhar o uso de memória pelo servidor;
- `npm run start:test` inicializa o servidor em modo `test` utilizando o `ts-node`. Assim como no primeiro caso, também irá rodar um número de processos conforme definido na variável de ambiente `WORKERS`, mas, diferente do primeiro, inicializa também Controllers (Producers) e Consumers constantes da pasta `test`.
